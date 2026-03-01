const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const { createOrderId, createOrderGroupId, createTrackingId } = require('../utils/id');
const { generateNumericOtp } = require('../utils/crypto');
const cartRepository = require('../repositories/cartRepository');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');
const parentOrderRepository = require('../repositories/parentOrderRepository');
const paymentRepository = require('../repositories/paymentRepository');
const userRepository = require('../repositories/userRepository');
const deliverySlotRepository = require('../repositories/deliverySlotRepository');
const couponService = require('./couponService');
const pricingService = require('./pricingService');
const inventoryService = require('./inventoryService');
const orderStateMachine = require('./orderStateMachineService');
const parentOrderService = require('./parentOrderService');
const paymentGatewayService = require('./paymentGatewayService');
const notificationService = require('./notificationService');
const env = require('../config/env');

const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'customer') return 'customer';
  if (value === 'seller') return 'seller';
  return '';
};

const loadCartItemsWithServerPrices = async (cartItems) => {
  const orderItems = [];
  const outOfStock = [];
  const uniqueProductIds = Array.from(new Set((cartItems || []).map((row) => String(row.productId))));
  const products = await productRepository.findProductsByIds(uniqueProductIds, {
    name: 1,
    sellerId: 1,
    variants: 1,
    categoryId: 1,
    isActive: 1,
    adminApproved: 1
  });
  const productMap = new Map(products.map((row) => [String(row._id), row]));

  for (const item of cartItems) {
    const product = productMap.get(String(item.productId));
    if (!product || !product.isActive || !product.adminApproved) {
      continue;
    }
    const variant = (product.variants || []).find((variantDoc) => String(variantDoc.variantId) === String(item.variantId));
    if (!variant || variant.stock < item.quantity) {
      outOfStock.push({
        productId: item.productId,
        variantId: item.variantId,
        requestedQty: item.quantity
      });
      continue;
    }
    orderItems.push({
      productId: product._id,
      variantId: variant.variantId,
      productName: product.name,
      variantLabel: variant.weight,
      quantity: item.quantity,
      unitPrice: variant.price,
      unitMRP: variant.MRP,
      lineTotal: Number((item.quantity * variant.price).toFixed(2)),
      sellerId: product.sellerId,
      categoryId: product.categoryId,
      sellerName: 'Seller'
    });
  }
  return { orderItems, outOfStock };
};

const assertOrderTransitionActorAccess = ({ order, nextStatus, actorUserId, actorRole }) => {
  const effectiveRole = normalizeRole(actorRole);
  const isAdmin = effectiveRole === 'admin';
  if (isAdmin) return;

  const isOwner = String(order.userId) === String(actorUserId);
  const isSeller = String(order.sellerId) === String(actorUserId);
  const sellerAllowed = [
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.PACKED,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED
  ];

  if (effectiveRole === 'seller') {
    if (isSeller) {
      if (!sellerAllowed.includes(nextStatus)) {
        throw new AppError('Forbidden status transition for seller', 403, 'FORBIDDEN');
      }
      return;
    }
  }

  if (effectiveRole === 'customer') {
    if (isOwner) {
      if (nextStatus !== ORDER_STATUS.CANCELLED) {
        throw new AppError('Forbidden status transition for user', 403, 'FORBIDDEN');
      }
      return;
    }
  }

  throw new AppError('Forbidden', 403, 'FORBIDDEN');
};

const releaseDeliverySlotForGroupIfEligible = async ({ orderGroupId, session }) => {
  if (!orderGroupId) return;
  const parent = await parentOrderRepository.findByOrderGroupId(orderGroupId, null, session);
  if (!parent) return;
  if (parent.aggregateOrderStatus !== ORDER_STATUS.CANCELLED || parent.deliverySlotReleased) return;

  await deliverySlotRepository.releaseSlotByDateWindow({
    date: parent.deliverySlot.date,
    timeWindow: parent.deliverySlot.timeWindow,
    session
  });
  parent.deliverySlotReleased = true;
  await parentOrderRepository.save(parent, session);
};

const createPendingOrder = async ({
  userId,
  shippingAddress,
  deliverySlotId,
  paymentMethod,
  couponCode
}) => {
  return inventoryService.withTransaction(async (session) => {
    const cart = await cartRepository.getOrCreateCart(userId);
    if (!cart.items.length) {
      throw new AppError('Cart is empty', 400, 'EMPTY_CART');
    }

    let slot = null;
    if (deliverySlotId) {
      slot = await deliverySlotRepository.reserveSlot(deliverySlotId, session);
      if (!slot) {
        throw new AppError('Delivery slot unavailable', 409, 'DELIVERY_SLOT_UNAVAILABLE');
      }
    } else {
      // Fallback slot for on-demand orders when no slots are configured
      slot = {
        date: new Date(),
        timeWindow: 'On-demand',
        capacity: 0,
        booked: 0
      };
    }

    const { orderItems, outOfStock } = await loadCartItemsWithServerPrices(cart.items);
    if (outOfStock.length > 0) {
      throw new AppError('Some items are out of stock', 409, 'INSUFFICIENT_STOCK', outOfStock);
    }

    const pricing = await pricingService.calculatePricingSummary({
      lines: orderItems,
      userId,
      couponCode: couponCode || cart.couponCode,
      categoryIds: orderItems.map((item) => item.categoryId),
      session
    });
    const subtotal = pricing.subtotal;
    const couponResult = pricing.couponResult;
    const couponDiscount = pricing.couponDiscount;
    const deliveryFee = pricing.deliveryFee;

    const now = new Date();
    const orderGroupId = createOrderGroupId();
    const itemsBySeller = orderItems.reduce((acc, item) => {
      const key = String(item.sellerId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const initialStatus = paymentMethod === 'COD' ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.PENDING_PAYMENT;
    const initialPaymentStatus = paymentMethod === 'COD' ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING;
    const sellerKeys = Object.keys(itemsBySeller);
    const createdOrders = [];

    for (let i = 0; i < sellerKeys.length; i += 1) {
      const sellerKey = sellerKeys[i];
      const sellerItems = itemsBySeller[sellerKey];
      const sellerSubtotal = sellerItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const sellerMrp = sellerItems.reduce((sum, item) => sum + item.quantity * item.unitMRP, 0);
      const sellerDiscount = Number((sellerMrp - sellerSubtotal).toFixed(2));
      const proportionalCoupon = subtotal > 0 ? Number(((sellerSubtotal / subtotal) * couponDiscount).toFixed(2)) : 0;
      const sellerDeliveryFee = i === 0 ? deliveryFee : 0;
      const taxableAmount = Math.max(0, sellerSubtotal - proportionalCoupon);
      const tax = Number(((taxableAmount * env.taxPercent) / 100).toFixed(2));
      const totalAmount = Number((taxableAmount + tax + sellerDeliveryFee).toFixed(2));

      const order = await orderRepository.createOrder(
        {
          orderId: createOrderId(),
          orderGroupId,
          userId,
          sellerId: sellerKey,
          orderItems: sellerItems.map(({ sellerId: sid, categoryId, ...safeItem }) => safeItem),
          shippingAddress,
          deliverySlot: { date: slot.date, timeWindow: slot.timeWindow },
          paymentMethod,
          paymentStatus: initialPaymentStatus,
          orderStatus: initialStatus,
          statusHistory: [
            {
              status: initialStatus,
              timestamp: now,
              note: paymentMethod === 'COD' ? 'COD order confirmed' : 'Order created',
              updatedBy: userId
            }
          ],
          totalMRP: Number(sellerMrp.toFixed(2)),
          totalDiscount: sellerDiscount,
          couponCode: couponResult.valid ? (couponCode || cart.couponCode).toUpperCase() : '',
          couponDiscount: Number(proportionalCoupon.toFixed(2)),
          deliveryFee: sellerDeliveryFee,
          tax,
          totalAmount
        },
        session
      );

      if (paymentMethod === 'COD') {
        await inventoryService.decrementStockForOrderItems({
          items: order.orderItems,
          performedBy: userId,
          referenceOrderId: order._id,
          session
        });
      }
      createdOrders.push(order);
    }

    const appliedCouponCode = couponResult.valid ? (couponCode || cart.couponCode).toUpperCase() : '';

    if (couponResult.valid) {
      await couponService.markCouponUsed({ coupon: couponResult.coupon, userId, session });
    }

    cart.items = [];
    cart.couponCode = '';
    await cartRepository.saveCart(cart, session);

    await parentOrderService.createFromChildOrders({
      orderGroupId,
      userId,
      shippingAddress,
      deliverySlot: { date: slot.date, timeWindow: slot.timeWindow },
      paymentMethod,
      couponCode: appliedCouponCode,
      session
    });

    return {
      orderGroupId,
      orderId: createdOrders[0]?.orderId || '',
      orderIds: createdOrders.map((row) => row.orderId),
      totalOrders: createdOrders.length
    };
  });
};

const confirmPaymentCore = async ({
  orderId,
  paymentGatewayOrderId,
  paymentGatewayPaymentId,
  updatedBy,
  updatedByRole,
  session
}) => {
  const order = await orderRepository.findByOrderId(orderId, null);
  if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  const isAdmin = normalizeRole(updatedByRole) === 'admin';
  const isOwner = String(order.userId) === String(updatedBy);
  if (!isAdmin && !isOwner) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
  if (order.orderStatus !== ORDER_STATUS.PENDING_PAYMENT) {
    throw new AppError('Order is not awaiting payment', 400, 'ORDER_STATE_INVALID');
  }

  orderStateMachine.assertTransition({
    currentStatus: order.orderStatus,
    nextStatus: ORDER_STATUS.CONFIRMED,
    paymentStatus: PAYMENT_STATUS.PAID
  });

  await inventoryService.decrementStockForOrderItems({
    items: order.orderItems,
    performedBy: updatedBy,
    referenceOrderId: order._id,
    session
  });

  let orderDoc = await orderRepository.findById(order._id, null, session);
  orderDoc.paymentStatus = PAYMENT_STATUS.PAID;
  orderDoc.paymentGatewayOrderId = paymentGatewayOrderId || orderDoc.paymentGatewayOrderId;
  orderDoc.paymentGatewayPaymentId = paymentGatewayPaymentId || orderDoc.paymentGatewayPaymentId;
  orderDoc.orderStatus = ORDER_STATUS.CONFIRMED;
  orderDoc.statusHistory.push({
    status: ORDER_STATUS.CONFIRMED,
    timestamp: new Date(),
    note: 'Payment confirmed',
    updatedBy
  });
  await orderRepository.save(orderDoc, session);
  if (orderDoc.orderGroupId) {
    await parentOrderService.refreshAggregateForGroup({ orderGroupId: orderDoc.orderGroupId, session });
  }
  return orderDoc;
};

const confirmPayment = ({
  orderId,
  paymentGatewayOrderId,
  paymentGatewayPaymentId,
  updatedBy,
  updatedByRole,
  session = null
}) => {
  if (session) {
    return confirmPaymentCore({
      orderId,
      paymentGatewayOrderId,
      paymentGatewayPaymentId,
      updatedBy,
      updatedByRole,
      session
    });
  }
  return inventoryService.withTransaction(async (sessionCtx) =>
    confirmPaymentCore({
      orderId,
      paymentGatewayOrderId,
      paymentGatewayPaymentId,
      updatedBy,
      updatedByRole,
      session: sessionCtx
    })
  );
};

const transitionOrderStatusCore = async ({
  orderId,
  nextStatus,
  updatedBy,
  updatedByRole,
  deliveryOtp,
  trackingId,
  session,
  skipParentRefresh = false
}) => {
  const order = await orderRepository.findByOrderId(orderId);
  if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  assertOrderTransitionActorAccess({
    order,
    nextStatus,
    actorUserId: updatedBy,
    actorRole: updatedByRole
  });

  orderStateMachine.assertTransition({
    currentStatus: order.orderStatus,
    nextStatus,
    paymentStatus: order.paymentStatus
  });

  let orderDoc = await orderRepository.findById(order._id, null, session);

  if (nextStatus === ORDER_STATUS.PACKED) {
    orderDoc.trackingId = createTrackingId();
  }

  if (nextStatus === ORDER_STATUS.SHIPPED && trackingId) {
    orderDoc.trackingId = trackingId;
  }

  if (nextStatus === ORDER_STATUS.OUT_FOR_DELIVERY) {
    const otpRaw = generateNumericOtp(6);
    orderDoc.deliveryOTP = await bcrypt.hash(otpRaw, env.bcryptSaltRounds);
    orderDoc.deliveryOTPExpiry = new Date(Date.now() + 30 * 60 * 1000);
    orderDoc.otpAttemptCount = 0;
    orderDoc.otpLockedUntil = null;
    const user = await userRepository.findById(orderDoc.userId);
    await notificationService.sendOtpNotification({
      orderId: orderDoc.orderId,
      otp: otpRaw,
      email: user?.email || '',
      phone: user?.phone || ''
    });
  }

  if (nextStatus === ORDER_STATUS.DELIVERED) {
    if (!orderDoc.deliveryOTP) {
      orderDoc = await orderRepository.findById(order._id, '+deliveryOTP +deliveryOTPExpiry', session);
    }
    if (!deliveryOtp) {
      throw new AppError('Delivery OTP is required', 400, 'DELIVERY_OTP_REQUIRED');
    }
    if (orderDoc.otpLockedUntil && new Date(orderDoc.otpLockedUntil) > new Date()) {
      throw new AppError('Delivery OTP locked. Try again later', 423, 'DELIVERY_OTP_LOCKED');
    }
    if (!orderDoc.deliveryOTP || !orderDoc.deliveryOTPExpiry || orderDoc.deliveryOTPExpiry < new Date()) {
      throw new AppError('Delivery OTP expired', 400, 'DELIVERY_OTP_EXPIRED');
    }
    const isOtpValid = await bcrypt.compare(String(deliveryOtp), orderDoc.deliveryOTP);
    if (!isOtpValid) {
      orderDoc.otpAttemptCount = Number(orderDoc.otpAttemptCount || 0) + 1;
      if (orderDoc.otpAttemptCount >= 5) {
        orderDoc.otpLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }
      await orderRepository.save(orderDoc, session);
      throw new AppError('Invalid delivery OTP', 400, 'DELIVERY_OTP_INVALID');
    }
    orderDoc.otpAttemptCount = 0;
    orderDoc.otpLockedUntil = null;
    orderDoc.deliveryOTP = '';
    orderDoc.deliveryOTPExpiry = null;
    for (const item of orderDoc.orderItems) {
      await productRepository.incrementSalesCount({
        productId: item.productId,
        quantity: item.quantity,
        session
      });
    }
  }

  if (nextStatus === ORDER_STATUS.CANCELLED) {
    if ([ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING].includes(orderDoc.orderStatus)) {
      await inventoryService.restoreStockForOrderItems({
        items: orderDoc.orderItems,
        performedBy: updatedBy,
        referenceOrderId: orderDoc._id,
        session
      });
    }
  }

  if (nextStatus === ORDER_STATUS.REFUND_INITIATED) {
    orderDoc.paymentStatus = PAYMENT_STATUS.REFUND_INITIATED;
  }

  if (nextStatus === ORDER_STATUS.REFUNDED) {
    orderDoc.paymentStatus = PAYMENT_STATUS.REFUNDED;
  }

  orderDoc.orderStatus = nextStatus;
  orderDoc.statusHistory.push({
    status: nextStatus,
    timestamp: new Date(),
    note: 'Status updated',
    updatedBy
  });

  await orderRepository.save(orderDoc, session);
  if (!skipParentRefresh && orderDoc.orderGroupId) {
    await parentOrderService.refreshAggregateForGroup({ orderGroupId: orderDoc.orderGroupId, session });
    await releaseDeliverySlotForGroupIfEligible({ orderGroupId: orderDoc.orderGroupId, session });
  } else if (!skipParentRefresh && nextStatus === ORDER_STATUS.CANCELLED) {
    await deliverySlotRepository.releaseSlotByDateWindow({
      date: orderDoc.deliverySlot.date,
      timeWindow: orderDoc.deliverySlot.timeWindow,
      session
    });
  }
  return orderDoc;
};

const transitionOrderStatus = async ({ orderId, nextStatus, updatedBy, updatedByRole, deliveryOtp, trackingId, session = null }) => {
  if (session) {
    return transitionOrderStatusCore({ orderId, nextStatus, updatedBy, updatedByRole, deliveryOtp, trackingId, session });
  }
  return inventoryService.withTransaction((sessionCtx) =>
    transitionOrderStatusCore({ orderId, nextStatus, updatedBy, updatedByRole, deliveryOtp, trackingId, session: sessionCtx })
  );
};

const assertGroupActorAccess = ({ parent, actorUserId, actorRole, adminOnly = false }) => {
  const isAdmin = normalizeRole(actorRole) === 'admin';
  if (adminOnly && !isAdmin) {
    throw new AppError('Only admin can perform this group action', 403, 'FORBIDDEN');
  }
  const isOwner = String(parent.userId) === String(actorUserId);
  if (!isAdmin && !isOwner) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
};

const cancelOrderGroup = async ({ orderGroupId, actorUserId, actorRole }) =>
  inventoryService.withTransaction(async (session) => {
    const parent = await parentOrderRepository.findByOrderGroupId(orderGroupId, null, session);
    if (!parent) throw new AppError('Order group not found', 404, 'ORDER_GROUP_NOT_FOUND');
    assertGroupActorAccess({ parent, actorUserId, actorRole });

    const children = await orderRepository.listByGroupId(orderGroupId, null, session);
    const cancellableStates = [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING];
    const terminalStates = [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUND_INITIATED, ORDER_STATUS.REFUNDED];

    const blockedChildren = children
      .filter((child) => !cancellableStates.includes(child.orderStatus) && !terminalStates.includes(child.orderStatus))
      .map((child) => ({ orderId: child.orderId, status: child.orderStatus }));

    if (blockedChildren.length > 0) {
      throw new AppError(
        'Some child orders are no longer cancellable',
        409,
        'GROUP_CANCELLATION_BLOCKED',
        blockedChildren
      );
    }

    const targets = children.filter((child) => cancellableStates.includes(child.orderStatus));
    if (!targets.length) {
      throw new AppError('No cancellable child orders found in this group', 409, 'NO_CANCELLABLE_CHILD_ORDERS');
    }

    for (const child of targets) {
      await transitionOrderStatusCore({
        orderId: child.orderId,
        nextStatus: ORDER_STATUS.CANCELLED,
        updatedBy: actorUserId,
        updatedByRole: actorRole,
        session,
        skipParentRefresh: true
      });
    }

    const parentDoc = await parentOrderService.refreshAggregateForGroup({ orderGroupId, session });
    await releaseDeliverySlotForGroupIfEligible({ orderGroupId, session });
    const childOrders = await orderRepository.listByGroupId(orderGroupId, null, session);
    return {
      orderGroupId,
      aggregateOrderStatus: parentDoc.aggregateOrderStatus,
      aggregatePaymentStatus: parentDoc.aggregatePaymentStatus,
      cancelledCount: targets.length,
      children: childOrders
    };
  });

const initiateGroupRefund = async ({ orderGroupId, actorUserId, actorRole }) =>
  inventoryService.withTransaction(async (session) => {
    const parent = await parentOrderRepository.findByOrderGroupId(orderGroupId, null, session);
    if (!parent) throw new AppError('Order group not found', 404, 'ORDER_GROUP_NOT_FOUND');
    assertGroupActorAccess({ parent, actorUserId, actorRole, adminOnly: true });

    const children = await orderRepository.listByGroupId(orderGroupId, null, session);
    const paidNotCancelled = children
      .filter((child) => child.paymentStatus === PAYMENT_STATUS.PAID && child.orderStatus !== ORDER_STATUS.CANCELLED)
      .map((child) => ({ orderId: child.orderId, orderStatus: child.orderStatus, paymentStatus: child.paymentStatus }));
    if (paidNotCancelled.length > 0) {
      throw new AppError(
        'Refund can be initiated only for cancelled paid child orders',
        409,
        'GROUP_REFUND_BLOCKED',
        paidNotCancelled
      );
    }

    const targets = children.filter(
      (child) => child.orderStatus === ORDER_STATUS.CANCELLED && child.paymentStatus === PAYMENT_STATUS.PAID
    );
    if (!targets.length) {
      throw new AppError('No refundable child orders found in this group', 409, 'NO_REFUNDABLE_CHILD_ORDERS');
    }

    const txByOrderId = new Map();
    for (const child of targets) {
      const paymentTx = await paymentRepository.findByOrderId(child._id, session);
      if (!paymentTx || !paymentTx.externalPaymentId) {
        throw new AppError(
          `Payment transaction not found for child order ${child.orderId}`,
          404,
          'PAYMENT_NOT_FOUND'
        );
      }
      txByOrderId.set(String(child._id), paymentTx);
    }

    const refunds = [];
    for (const child of targets) {
      const paymentTx = txByOrderId.get(String(child._id));
      const refund = await paymentGatewayService.initiateRefund({
        externalPaymentId: paymentTx.externalPaymentId,
        amount: child.totalAmount
      });

      const txDoc = await paymentRepository.findById(paymentTx._id, session);
      txDoc.status = 'REFUND_INITIATED';
      txDoc.refundReferenceId = refund.refundReferenceId;
      await paymentRepository.save(txDoc, session);

      const childDoc = await orderRepository.findById(child._id, null, session);
      childDoc.refundReferenceId = refund.refundReferenceId;
      await orderRepository.save(childDoc, session);

      await transitionOrderStatusCore({
        orderId: child.orderId,
        nextStatus: ORDER_STATUS.REFUND_INITIATED,
        updatedBy: actorUserId,
        updatedByRole: actorRole,
        session,
        skipParentRefresh: true
      });

      refunds.push({ orderId: child.orderId, refundReferenceId: refund.refundReferenceId });
    }

    const parentDoc = await parentOrderService.refreshAggregateForGroup({ orderGroupId, session });
    const childOrders = await orderRepository.listByGroupId(orderGroupId, null, session);
    return {
      orderGroupId,
      aggregateOrderStatus: parentDoc.aggregateOrderStatus,
      aggregatePaymentStatus: parentDoc.aggregatePaymentStatus,
      refunds,
      children: childOrders
    };
  });

const settleGroupRefund = async ({ orderGroupId, actorUserId, actorRole, refundReferenceId }) =>
  inventoryService.withTransaction(async (session) => {
    const parent = await parentOrderRepository.findByOrderGroupId(orderGroupId, null, session);
    if (!parent) throw new AppError('Order group not found', 404, 'ORDER_GROUP_NOT_FOUND');
    assertGroupActorAccess({ parent, actorUserId, actorRole, adminOnly: true });

    const children = await orderRepository.listByGroupId(orderGroupId, null, session);
    const invalidChildren = children
      .filter((child) => ![ORDER_STATUS.REFUND_INITIATED, ORDER_STATUS.REFUNDED].includes(child.orderStatus))
      .map((child) => ({ orderId: child.orderId, orderStatus: child.orderStatus }));
    if (invalidChildren.length > 0) {
      throw new AppError(
        'All child orders must be in REFUND_INITIATED or REFUNDED before settlement',
        409,
        'GROUP_REFUND_SETTLEMENT_BLOCKED',
        invalidChildren
      );
    }

    const targets = children.filter((child) => child.orderStatus === ORDER_STATUS.REFUND_INITIATED);
    if (!targets.length) {
      throw new AppError('No refundable child orders pending settlement', 409, 'NO_PENDING_GROUP_REFUNDS');
    }

    for (const child of targets) {
      const paymentTx = await paymentRepository.findByOrderId(child._id, session);
      if (paymentTx) {
        const txDoc = await paymentRepository.findById(paymentTx._id, session);
        txDoc.status = 'REFUNDED';
        if (refundReferenceId) {
          txDoc.refundReferenceId = refundReferenceId;
        }
        await paymentRepository.save(txDoc, session);
      }
      await transitionOrderStatusCore({
        orderId: child.orderId,
        nextStatus: ORDER_STATUS.REFUNDED,
        updatedBy: actorUserId,
        updatedByRole: actorRole,
        session,
        skipParentRefresh: true
      });
    }

    const parentDoc = await parentOrderService.refreshAggregateForGroup({ orderGroupId, session });
    const childOrders = await orderRepository.listByGroupId(orderGroupId, null, session);
    return {
      orderGroupId,
      aggregateOrderStatus: parentDoc.aggregateOrderStatus,
      aggregatePaymentStatus: parentDoc.aggregatePaymentStatus,
      refundedCount: targets.length,
      children: childOrders
    };
  });

module.exports = {
  createPendingOrder,
  confirmPayment,
  transitionOrderStatus,
  cancelOrderGroup,
  initiateGroupRefund,
  settleGroupRefund
};
