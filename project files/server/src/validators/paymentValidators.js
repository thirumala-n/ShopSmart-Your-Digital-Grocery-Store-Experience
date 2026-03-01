const { body } = require('express-validator');

const createGatewayOrder = [
  body('orderId').isString().trim().isLength({ min: 8 }),
  body('idempotencyKey').isString().trim().isLength({ min: 8, max: 120 })
];

const initiateRefund = [body('orderId').isString().trim().isLength({ min: 8 })];

const webhook = [
  body().isObject(),
  body('externalOrderId').optional().isString().trim().isLength({ min: 6, max: 120 }),
  body('externalPaymentId').optional().isString().trim().isLength({ min: 6, max: 120 }),
  body('event').optional().isString().trim().isLength({ min: 3, max: 120 }),
  body('status').optional().isString().trim().isLength({ min: 3, max: 64 })
];

module.exports = { createGatewayOrder, initiateRefund, webhook };
