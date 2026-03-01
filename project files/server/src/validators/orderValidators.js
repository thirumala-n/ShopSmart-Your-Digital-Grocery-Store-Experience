const { body, param } = require('express-validator');
const { ORDER_STATUS } = require('../utils/constants');

const placeOrder = [
  body('shippingAddress.fullName').isString().trim().isLength({ min: 2, max: 120 }),
  body('shippingAddress.phone').isString().trim().isLength({ min: 10, max: 20 }),
  body('shippingAddress.line1').isString().trim().isLength({ min: 5, max: 200 }),
  body('shippingAddress.line2').optional().isString().trim().isLength({ max: 200 }),
  body('shippingAddress.city').isString().trim().isLength({ min: 2, max: 120 }),
  body('shippingAddress.state').isString().trim().isLength({ min: 2, max: 120 }),
  body('shippingAddress.pincode').isString().trim().isLength({ min: 4, max: 12 }),
  body('shippingAddress.label').optional().isString().trim().isLength({ min: 2, max: 32 }),
  body('deliverySlotId').optional().isMongoId(),
  body('paymentMethod').isIn(['COD', 'ONLINE']),
  body('couponCode').optional().isString().trim().isLength({ min: 3, max: 30 }).toUpperCase()
];

const confirmPayment = [
  param('orderId').isString().trim().isLength({ min: 10 }),
  body('paymentGatewayOrderId').optional().isString().trim(),
  body('paymentGatewayPaymentId').optional().isString().trim()
];

const updateStatus = [
  param('orderId').isString().trim().isLength({ min: 10 }),
  body('nextStatus').isIn(Object.values(ORDER_STATUS)),
  body('deliveryOtp').optional().isString().trim().isLength({ min: 4, max: 8 }),
  body('trackingId').optional().isString().trim().isLength({ min: 4, max: 80 })
];

const orderGroupParam = [param('orderGroupId').isString().trim().isLength({ min: 8, max: 64 })];
const orderIdParam = [param('orderId').isString().trim().isLength({ min: 10, max: 64 })];
const settleGroupRefund = [
  ...orderGroupParam,
  body('refundReferenceId').optional().isString().trim().isLength({ min: 3, max: 120 })
];

module.exports = { placeOrder, confirmPayment, updateStatus, orderGroupParam, orderIdParam, settleGroupRefund };
