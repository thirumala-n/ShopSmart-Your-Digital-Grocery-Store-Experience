const asyncHandler = require('../utils/asyncHandler');
const { getPagination } = require('../utils/pagination');
const orderService = require('../services/orderService');
const orderRepository = require('../repositories/orderRepository');
const parentOrderRepository = require('../repositories/parentOrderRepository');
const parentOrderService = require('../services/parentOrderService');
const { ROLES } = require('../utils/constants');
const auditLogService = require('../services/auditLogService');

const placeOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createPendingOrder({
    userId: req.auth.userId,
    shippingAddress: req.body.shippingAddress,
    deliverySlotId: req.body.deliverySlotId,
    paymentMethod: req.body.paymentMethod,
    couponCode: req.body.couponCode
  });
  res.status(201).json({ success: true, data: order });
});

const confirmPayment = asyncHandler(async (req, res) => {
  const order = await orderService.confirmPayment({
    orderId: req.params.orderId,
    paymentGatewayOrderId: req.body.paymentGatewayOrderId,
    paymentGatewayPaymentId: req.body.paymentGatewayPaymentId,
    updatedBy: req.auth.userId,
    updatedByRole: req.auth.role
  });
  res.status(200).json({ success: true, data: order });
});

const updateStatus = asyncHandler(async (req, res) => {
  const before = await orderRepository.findByOrderId(req.params.orderId);
  const order = await orderService.transitionOrderStatus({
    orderId: req.params.orderId,
    nextStatus: req.body.nextStatus,
    updatedBy: req.auth.userId,
    updatedByRole: req.auth.role,
    deliveryOtp: req.body.deliveryOtp,
    trackingId: req.body.trackingId
  });
  if (req.auth.role === ROLES.ADMIN && before) {
    await auditLogService.createAuditLog({
      action: 'ORDER_STATUS_OVERRIDE',
      performedBy: req.auth.userId,
      targetType: 'ORDER',
      targetId: req.params.orderId,
      previousValue: { orderStatus: before.orderStatus, paymentStatus: before.paymentStatus },
      newValue: { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus },
      req
    });
  }
  res.status(200).json({ success: true, data: order });
});

const listMyOrders = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const data = await orderRepository.listUserOrders({
    userId: req.auth.userId,
    activeOnly: req.query.type !== 'history',
    page,
    pageSize,
    skip
  });
  res.status(200).json({ success: true, ...data });
});

const listMyOrderGroups = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const data = await parentOrderRepository.listByUser({
    userId: req.auth.userId,
    activeOnly: req.query.type !== 'history',
    page,
    pageSize,
    skip
  });
  res.status(200).json({ success: true, ...data });
});

const getByOrderId = asyncHandler(async (req, res) => {
  const order = await orderRepository.findByOrderId(req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, code: 'ORDER_NOT_FOUND', message: 'Order not found' });
  }
  const isAdmin = req.auth.role === ROLES.ADMIN;
  const isSeller = req.auth.role === ROLES.SELLER && String(order.sellerId) === req.auth.userId;
  const isOwner = String(order.userId) === req.auth.userId;
  if (!isAdmin && !isSeller && !isOwner) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Forbidden' });
  }
  return res.status(200).json({ success: true, data: order });
});

const getByOrderGroupId = asyncHandler(async (req, res) => {
  const data = await parentOrderService.getOrderGroupForUser({
    orderGroupId: req.params.orderGroupId,
    userId: req.auth.userId,
    role: req.auth.role
  });
  res.status(200).json({ success: true, data });
});

const cancelOrderGroup = asyncHandler(async (req, res) => {
  const data = await orderService.cancelOrderGroup({
    orderGroupId: req.params.orderGroupId,
    actorUserId: req.auth.userId,
    actorRole: req.auth.role
  });
  res.status(200).json({ success: true, data });
});

const initiateGroupRefund = asyncHandler(async (req, res) => {
  const data = await orderService.initiateGroupRefund({
    orderGroupId: req.params.orderGroupId,
    actorUserId: req.auth.userId,
    actorRole: req.auth.role
  });
  res.status(200).json({ success: true, data });
});

const settleGroupRefund = asyncHandler(async (req, res) => {
  const data = await orderService.settleGroupRefund({
    orderGroupId: req.params.orderGroupId,
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    refundReferenceId: req.body.refundReferenceId
  });
  res.status(200).json({ success: true, data });
});

module.exports = {
  placeOrder,
  confirmPayment,
  updateStatus,
  listMyOrders,
  listMyOrderGroups,
  getByOrderId,
  getByOrderGroupId,
  cancelOrderGroup,
  initiateGroupRefund,
  settleGroupRefund
};
