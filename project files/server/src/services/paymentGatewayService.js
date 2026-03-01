const crypto = require('crypto');
const { randomUUID } = require('crypto');
const env = require('../config/env');

const provider = process.env.PAYMENT_PROVIDER || 'MOCK';

const createPaymentOrder = async ({ orderId, amount, currency = 'INR' }) => {
  if (provider === 'MOCK') {
    return {
      provider: 'MOCK',
      externalOrderId: `mock_order_${randomUUID()}`,
      amount,
      currency,
      paymentUrl: `/mock-payment?orderId=${orderId}`
    };
  }
  return {
    provider,
    externalOrderId: `${provider.toLowerCase()}_${randomUUID()}`,
    amount,
    currency,
    paymentUrl: `/pay/${provider.toLowerCase()}/${orderId}`
  };
};

const verifyWebhook = async (payload, signature, rawBody) => {
  if (provider === 'MOCK') {
    return {
      valid: true,
      eventId: payload.eventId || payload.id || `mock_evt_${randomUUID()}`,
      event: payload.event || 'payment.captured',
      externalOrderId: payload.externalOrderId,
      externalPaymentId: payload.externalPaymentId || `mock_pay_${randomUUID()}`,
      status: payload.status || 'CAPTURED',
      refundReferenceId: payload.refundReferenceId || ''
    };
  }

  const secret = String(env.paymentWebhookSecret || '');
  if (!secret || !signature || !rawBody) {
    return { valid: false };
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const normalizedSignature = String(signature).startsWith('sha256=')
    ? String(signature).slice('sha256='.length)
    : String(signature);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(normalizedSignature, 'hex');
  if (expectedBuffer.length !== signatureBuffer.length) {
    return { valid: false };
  }
  const isValid = crypto.timingSafeEqual(expectedBuffer, signatureBuffer);

  return {
    valid: isValid,
    eventId: payload.eventId || payload.id || '',
    event: payload.event || 'payment.captured',
    externalOrderId: payload.externalOrderId,
    externalPaymentId: payload.externalPaymentId,
    status: payload.status || 'CAPTURED',
    refundReferenceId: payload.refundReferenceId || ''
  };
};

const initiateRefund = async ({ externalPaymentId, amount }) => {
  return {
    refundReferenceId: `refund_${randomUUID()}`,
    externalPaymentId,
    amount,
    status: 'REFUND_INITIATED'
  };
};

module.exports = {
  createPaymentOrder,
  verifyWebhook,
  initiateRefund
};
