const asyncHandler = require('../utils/asyncHandler');
const paymentService = require('../services/paymentService');
const AppError = require('../utils/AppError');

const createGatewayOrder = asyncHandler(async (req, res) => {
  const data = await paymentService.createGatewayOrder({
    orderId: req.body.orderId,
    userId: req.auth.userId,
    idempotencyKey: req.body.idempotencyKey
  });
  res.status(200).json({ success: true, data });
});

const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-payment-signature'] || '';
  let payload = req.body;
  if (Buffer.isBuffer(req.body)) {
    try {
      payload = JSON.parse(req.body.toString('utf8') || '{}');
    } catch (error) {
      throw new AppError('Invalid webhook payload', 400, 'INVALID_WEBHOOK_PAYLOAD');
    }
  }
  const data = await paymentService.handlePaymentWebhook({
    payload,
    signature,
    rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}), 'utf8')
  });
  res.status(200).json({ success: true, data });
});

const initiateRefund = asyncHandler(async (req, res) => {
  const data = await paymentService.initiateRefund({
    orderId: req.body.orderId,
    requestedBy: req.auth.userId
  });
  res.status(200).json({ success: true, data });
});

module.exports = {
  createGatewayOrder,
  webhook,
  initiateRefund
};
