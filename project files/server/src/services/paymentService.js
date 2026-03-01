const AppError = require('../utils/AppError');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const orderRepository = require('../repositories/orderRepository');
const paymentRepository = require('../repositories/paymentRepository');
const cartRepository = require('../repositories/cartRepository');
const orderService = require('./orderService');
const paymentGatewayService = require('./paymentGatewayService');
const inventoryService = require('./inventoryService');
const processedWebhookEventRepository = require('../repositories/processedWebhookEventRepository');

const isPayableOnlineOrder = (order) =>
  order &&
  order.paymentMethod === 'ONLINE' &&
  order.orderStatus === ORDER_STATUS.PENDING_PAYMENT &&
  order.paymentStatus === PAYMENT_STATUS.PENDING;

const resolvePayableOrdersForRequest = async ({ order, userId }) => {
  if (String(order.userId) !== String(userId)) throw new AppError('Forbidden', 403, 'FORBIDDEN');
  if (order.paymentMethod !== 'ONLINE') throw new AppError('Order is not online payment type', 400, 'PAYMENT_MODE_INVALID');

  if (!order.orderGroupId) {
    if (!isPayableOnlineOrder(order)) {
      throw new AppError('Order not in payable state', 400, 'ORDER_STATE_INVALID');
    }
    return [order];
  }

  const children = await orderRepository.listByGroupId(order.orderGroupId);
  const sameUserChildren = children.filter((row) => String(row.userId) === String(userId));
  const payableChildren = sameUserChildren.filter((row) => isPayableOnlineOrder(row));
  if (!payableChildren.length) {
    throw new AppError('Order group has no payable child orders', 400, 'ORDER_STATE_INVALID');
  }
  return payableChildren;
};

const createGatewayOrder = async ({ orderId, userId, idempotencyKey }) => {
  const normalizedIdempotencyKey = String(idempotencyKey || '').trim();
  if (!normalizedIdempotencyKey) {
    throw new AppError('idempotencyKey is required', 400, 'IDEMPOTENCY_KEY_REQUIRED');
  }

  const existingTx = await paymentRepository.findByIdempotencyKey(normalizedIdempotencyKey);
  if (existingTx) {
    const withinWindow = new Date(existingTx.createdAt).getTime() >= Date.now() - 24 * 60 * 60 * 1000;
    if (withinWindow) {
      const relatedOrder = await orderRepository.findById(existingTx.orderId);
      return {
        paymentTransactionId: existingTx._id,
        orderId: relatedOrder?.orderId || orderId,
        externalOrderId: existingTx.externalOrderId,
        paymentUrl: existingTx.metadata?.paymentUrl || '',
        amount: existingTx.metadata?.payableAmount || existingTx.amount,
        currency: existingTx.currency
      };
    }
  }

  const requestedOrder = await orderRepository.findByOrderId(orderId);
  if (!requestedOrder) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');

  const payableOrders = await resolvePayableOrdersForRequest({ order: requestedOrder, userId });
  const payableAmount = Number(payableOrders.reduce((sum, row) => sum + (row.totalAmount || 0), 0).toFixed(2));
  const gatewayReference = requestedOrder.orderGroupId || requestedOrder.orderId;

  const gatewayOrder = await paymentGatewayService.createPaymentOrder({
    orderId: gatewayReference,
    amount: payableAmount,
    currency: 'INR'
  });

  return inventoryService.withTransaction(async (session) => {
    const createdTransactions = [];
    for (const row of payableOrders) {
      const paymentDoc = await paymentRepository.createTransaction(
        {
          orderId: row._id,
          externalOrderId: gatewayOrder.externalOrderId,
          amount: row.totalAmount,
          currency: 'INR',
          gateway: gatewayOrder.provider,
          status: 'CREATED',
          metadata: {
            orderId: row.orderId,
            orderGroupId: row.orderGroupId || '',
            payableAmount,
            paymentUrl: gatewayOrder.paymentUrl
          }
        },
        session
      );
      if (createdTransactions.length === 0) {
        paymentDoc.idempotencyKey = normalizedIdempotencyKey;
        paymentDoc.idempotencyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await paymentRepository.save(paymentDoc, session);
      }
      createdTransactions.push(paymentDoc);

      const orderDoc = await orderRepository.findById(row._id, null, session);
      orderDoc.paymentGatewayOrderId = gatewayOrder.externalOrderId;
      await orderRepository.save(orderDoc, session);
    }

    return {
      paymentTransactionId: createdTransactions[0]?._id || null,
      orderId: requestedOrder.orderId,
      externalOrderId: gatewayOrder.externalOrderId,
      paymentUrl: gatewayOrder.paymentUrl,
      amount: gatewayOrder.amount,
      currency: gatewayOrder.currency
    };
  });
};

const handlePaymentWebhook = async ({ payload, signature, rawBody }) => {
  const verified = await paymentGatewayService.verifyWebhook(payload, signature, rawBody);
  if (!verified.valid) throw new AppError('Invalid webhook signature', 400, 'INVALID_WEBHOOK_SIGNATURE');

  if (verified.eventId) {
    const existingEvent = await processedWebhookEventRepository.findByEventId(verified.eventId);
    if (existingEvent) return { ok: true, duplicate: true };
    try {
      await processedWebhookEventRepository.createEvent({
        eventId: verified.eventId,
        provider: String(process.env.PAYMENT_PROVIDER || 'MOCK'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
    } catch (error) {
      if (error?.code === 11000) return { ok: true, duplicate: true };
      throw error;
    }
  }

  const tx = await paymentRepository.findByExternalOrderId(verified.externalOrderId);
  if (!tx && !verified.refundReferenceId && !verified.externalPaymentId) {
    throw new AppError('Payment transaction not found', 404, 'PAYMENT_NOT_FOUND');
  }

  if (verified.status === 'CAPTURED' || verified.event === 'payment.captured') {
    return inventoryService.withTransaction(async (session) => {
      const txDocs = await paymentRepository.listByExternalOrderId(verified.externalOrderId, session);
      if (!txDocs.length) throw new AppError('Payment transaction not found', 404, 'PAYMENT_NOT_FOUND');

      let hasPendingCapture = false;
      for (const txDoc of txDocs) {
        if (txDoc.status !== 'CAPTURED') {
          hasPendingCapture = true;
          txDoc.status = 'CAPTURED';
          txDoc.externalPaymentId = verified.externalPaymentId || txDoc.externalPaymentId;
          await paymentRepository.save(txDoc, session);
        }
      }
      if (!hasPendingCapture) return { ok: true, duplicate: true };

      let confirmedCount = 0;
      for (const txDoc of txDocs) {
        const orderDoc = await orderRepository.findById(txDoc.orderId, null, session);
        if (!orderDoc || orderDoc.orderStatus !== ORDER_STATUS.PENDING_PAYMENT) {
          continue;
        }
        await orderService.confirmPayment({
          orderId: orderDoc.orderId,
          paymentGatewayOrderId: verified.externalOrderId,
          paymentGatewayPaymentId: verified.externalPaymentId,
          updatedBy: orderDoc.userId,
          updatedByRole: 'ADMIN',
          session
        });
        confirmedCount += 1;
      }
      return { ok: true, confirmedCount };
    });
  }

  if (
    verified.status === 'REFUNDED' ||
    verified.event === 'refund.processed' ||
    verified.event === 'payment.refund.processed'
  ) {
    return inventoryService.withTransaction(async (session) => {
      let refundTx = null;
      if (verified.refundReferenceId) {
        refundTx = await paymentRepository.findByRefundReferenceId(verified.refundReferenceId, session);
      }
      if (!refundTx && verified.externalPaymentId) {
        refundTx = await paymentRepository.findByExternalPaymentId(verified.externalPaymentId, session);
      }
      if (!refundTx && tx) {
        refundTx = await paymentRepository.findById(tx._id, session);
      }
      if (!refundTx) throw new AppError('Payment transaction not found', 404, 'PAYMENT_NOT_FOUND');
      if (refundTx.status === 'REFUNDED') return { ok: true, duplicate: true };

      refundTx.status = 'REFUNDED';
      if (verified.refundReferenceId) {
        refundTx.refundReferenceId = verified.refundReferenceId;
      }
      await paymentRepository.save(refundTx, session);

      const orderDoc = await orderRepository.findById(refundTx.orderId, null, session);
      if (!orderDoc) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      if (orderDoc.orderStatus === ORDER_STATUS.REFUNDED) return { ok: true, duplicate: true };
      if (orderDoc.orderStatus !== ORDER_STATUS.REFUND_INITIATED) {
        return { ok: true };
      }

      await orderService.transitionOrderStatus({
        orderId: orderDoc.orderId,
        nextStatus: ORDER_STATUS.REFUNDED,
        updatedBy: orderDoc.userId,
        updatedByRole: 'ADMIN',
        session
      });
      return { ok: true };
    });
  }

  if (verified.status === 'FAILED') {
    return inventoryService.withTransaction(async (session) => {
      const txDocs = await paymentRepository.listByExternalOrderId(verified.externalOrderId, session);
      if (!txDocs.length) throw new AppError('Payment transaction not found', 404, 'PAYMENT_NOT_FOUND');
      const pending = txDocs.filter((row) => row.status !== 'FAILED');
      if (!pending.length) return { ok: true, duplicate: true };
      const restoredUsers = new Set();
      for (const txDoc of pending) {
        txDoc.status = 'FAILED';
        await paymentRepository.save(txDoc, session);
        const orderDoc = await orderRepository.findById(txDoc.orderId, null, session);
        if (!orderDoc) continue;
        if (orderDoc.orderStatus !== ORDER_STATUS.PENDING_PAYMENT) continue;
        const userKey = String(orderDoc.userId);
        if (restoredUsers.has(userKey)) continue;
        restoredUsers.add(userKey);
        await cartRepository.mergeItems({
          userId: orderDoc.userId,
          items: (orderDoc.orderItems || []).map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity
          })),
          couponCode: orderDoc.couponCode || '',
          session
        });
      }
      return { ok: true };
    });
  }

  return { ok: true };
};

const initiateRefund = async ({ orderId, requestedBy }) => {
  const order = await orderRepository.findByOrderId(orderId);
  if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');

  const tx = await paymentRepository.findByExternalOrderId(order.paymentGatewayOrderId);
  if (!tx) throw new AppError('Payment transaction not found', 404, 'PAYMENT_NOT_FOUND');
  const refund = await paymentGatewayService.initiateRefund({
    externalPaymentId: tx.externalPaymentId,
    amount: order.totalAmount
  });

  return inventoryService.withTransaction(async (session) => {
    const txDoc = await paymentRepository.findById(tx._id, session);
    txDoc.status = 'REFUND_INITIATED';
    txDoc.refundReferenceId = refund.refundReferenceId;
    await paymentRepository.save(txDoc, session);

    const orderDoc = await orderRepository.findById(order._id, null, session);
    orderDoc.refundReferenceId = refund.refundReferenceId;
    await orderRepository.save(orderDoc, session);

    await orderService.transitionOrderStatus({
      orderId: order.orderId,
      nextStatus: 'REFUND_INITIATED',
      updatedBy: requestedBy,
      updatedByRole: 'ADMIN',
      session
    });

    return {
      orderId: order.orderId,
      refundReferenceId: refund.refundReferenceId
    };
  });
};

module.exports = {
  createGatewayOrder,
  handlePaymentWebhook,
  initiateRefund
};
