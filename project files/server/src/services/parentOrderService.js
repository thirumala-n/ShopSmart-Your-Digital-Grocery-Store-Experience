const AppError = require('../utils/AppError');
const orderRepository = require('../repositories/orderRepository');
const parentOrderRepository = require('../repositories/parentOrderRepository');

const hasAny = (set, values) => values.some((v) => set.has(v));
const allAre = (arr, values) => arr.every((v) => values.includes(v));

const deriveAggregateOrderStatus = (statuses) => {
  const set = new Set(statuses);
  if (statuses.length === 0) return 'PENDING_PAYMENT';

  if (allAre(statuses, ['REFUNDED'])) return 'REFUNDED';
  if (allAre(statuses, ['CANCELLED'])) return 'CANCELLED';
  if (hasAny(set, ['REFUND_INITIATED'])) {
    return set.size === 1 ? 'REFUND_INITIATED' : 'PARTIALLY_REFUNDED';
  }
  if (hasAny(set, ['CANCELLED']) && hasAny(set, ['DELIVERED'])) return 'PARTIALLY_DELIVERED';
  if (hasAny(set, ['CANCELLED'])) return 'PARTIALLY_CANCELLED';
  if (allAre(statuses, ['DELIVERED'])) return 'DELIVERED';
  if (hasAny(set, ['OUT_FOR_DELIVERY'])) return 'OUT_FOR_DELIVERY';
  if (hasAny(set, ['SHIPPED'])) return 'SHIPPED';
  if (hasAny(set, ['PACKED'])) return 'PACKED';
  if (hasAny(set, ['PROCESSING'])) return 'PROCESSING';
  if (hasAny(set, ['CONFIRMED'])) return 'CONFIRMED';
  return 'PENDING_PAYMENT';
};

const deriveAggregatePaymentStatus = (statuses) => {
  const set = new Set(statuses);
  if (statuses.length === 0) return 'PENDING';
  if (allAre(statuses, ['REFUNDED'])) return 'REFUNDED';
  if (hasAny(set, ['REFUND_INITIATED'])) return set.size === 1 ? 'REFUND_INITIATED' : 'PARTIALLY_REFUNDED';
  if (allAre(statuses, ['PAID'])) return 'PAID';
  if (hasAny(set, ['PAID']) && hasAny(set, ['PENDING'])) return 'PARTIALLY_PAID';
  return 'PENDING';
};

const createFromChildOrders = async ({ orderGroupId, userId, shippingAddress, deliverySlot, paymentMethod, couponCode, session = null }) => {
  const children = await orderRepository.listByGroupId(orderGroupId, null, session);
  if (!children.length) {
    throw new AppError('No child orders found for group', 404, 'ORDER_GROUP_NOT_FOUND');
  }

  const totalMRP = children.reduce((sum, o) => sum + (o.totalMRP || 0), 0);
  const totalDiscount = children.reduce((sum, o) => sum + (o.totalDiscount || 0), 0);
  const couponDiscount = children.reduce((sum, o) => sum + (o.couponDiscount || 0), 0);
  const deliveryFee = children.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
  const tax = children.reduce((sum, o) => sum + (o.tax || 0), 0);
  const totalAmount = children.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const childSummaries = children.map((child) => ({
    orderId: child.orderId,
    sellerId: child.sellerId,
    orderStatus: child.orderStatus,
    paymentStatus: child.paymentStatus,
    totalAmount: child.totalAmount
  }));

  return parentOrderRepository.createParentOrder(
    {
      orderGroupId,
      userId,
      childOrderIds: children.map((c) => c.orderId),
      childSummaries,
      aggregateOrderStatus: deriveAggregateOrderStatus(childSummaries.map((row) => row.orderStatus)),
      aggregatePaymentStatus: deriveAggregatePaymentStatus(childSummaries.map((row) => row.paymentStatus)),
      paymentMethod,
      shippingAddress,
      deliverySlot,
      deliverySlotReleased: false,
      totalMRP: Number(totalMRP.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      couponCode: couponCode || '',
      couponDiscount: Number(couponDiscount.toFixed(2)),
      deliveryFee: Number(deliveryFee.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2))
    },
    session
  );
};

const refreshAggregateForGroup = async ({ orderGroupId, session = null }) => {
  const parent = await parentOrderRepository.findByOrderGroupId(orderGroupId, null, session);
  if (!parent) {
    throw new AppError('Parent order group not found', 404, 'ORDER_GROUP_NOT_FOUND');
  }

  const children = await orderRepository.listByGroupId(orderGroupId, null, session);
  if (!children.length) {
    throw new AppError('No child orders found for group', 404, 'ORDER_GROUP_NOT_FOUND');
  }

  const childSummaries = children.map((child) => ({
    orderId: child.orderId,
    sellerId: child.sellerId,
    orderStatus: child.orderStatus,
    paymentStatus: child.paymentStatus,
    totalAmount: child.totalAmount
  }));

  parent.childOrderIds = children.map((c) => c.orderId);
  parent.childSummaries = childSummaries;
  parent.aggregateOrderStatus = deriveAggregateOrderStatus(childSummaries.map((row) => row.orderStatus));
  parent.aggregatePaymentStatus = deriveAggregatePaymentStatus(childSummaries.map((row) => row.paymentStatus));
  parent.totalMRP = Number(children.reduce((sum, o) => sum + (o.totalMRP || 0), 0).toFixed(2));
  parent.totalDiscount = Number(children.reduce((sum, o) => sum + (o.totalDiscount || 0), 0).toFixed(2));
  parent.couponDiscount = Number(children.reduce((sum, o) => sum + (o.couponDiscount || 0), 0).toFixed(2));
  parent.deliveryFee = Number(children.reduce((sum, o) => sum + (o.deliveryFee || 0), 0).toFixed(2));
  parent.tax = Number(children.reduce((sum, o) => sum + (o.tax || 0), 0).toFixed(2));
  parent.totalAmount = Number(children.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toFixed(2));

  await parentOrderRepository.save(parent, session);
  return parent;
};

const getOrderGroupForUser = async ({ orderGroupId, userId, role }) => {
  const parent = await parentOrderRepository.findByOrderGroupId(orderGroupId);
  if (!parent) throw new AppError('Order group not found', 404, 'ORDER_GROUP_NOT_FOUND');

  const children = await orderRepository.listByGroupId(orderGroupId);
  const normalizedRole = String(role || '').trim().toLowerCase();
  const isAdmin = normalizedRole === 'admin';
  const isOwner = String(parent.userId) === String(userId);
  const isSeller = normalizedRole === 'seller' && children.some((child) => String(child.sellerId) === String(userId));
  if (!isAdmin && !isOwner && !isSeller) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }

  return {
    parent,
    children: isSeller && !isAdmin
      ? children.filter((child) => String(child.sellerId) === String(userId))
      : children
  };
};

module.exports = {
  createFromChildOrders,
  refreshAggregateForGroup,
  getOrderGroupForUser
};
