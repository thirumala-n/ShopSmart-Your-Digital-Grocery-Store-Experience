const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const { sendEmail } = require('./emailService');

const sendSms = async ({ to, message }) => {
  const webhookUrl = process.env.SMS_WEBHOOK_URL || '';
  if (!webhookUrl) {
    logger.warn(`SMS webhook not configured. SMS skipped for ${to}`);
    return { queued: false };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message })
  });

  if (!response.ok) {
    throw new AppError('SMS provider request failed', 502, 'SMS_PROVIDER_ERROR');
  }

  return { queued: true };
};

const sendOtpNotification = async ({ orderId, otp, email, phone }) => {
  const emailPromise = email
    ? sendEmail({
        to: email,
        subject: `Delivery OTP for order ${orderId}`,
        text: `Your delivery OTP for order ${orderId} is ${otp}. It expires in 30 minutes.`
      })
    : Promise.resolve({ queued: false });

  const smsPromise = phone
    ? sendSms({
        to: phone,
        message: `Delivery OTP for order ${orderId}: ${otp}. Valid for 30 minutes.`
      })
    : Promise.resolve({ queued: false });

  const [emailResult, smsResult] = await Promise.allSettled([emailPromise, smsPromise]);
  const emailQueued = emailResult.status === 'fulfilled' && emailResult.value?.queued;
  const smsQueued = smsResult.status === 'fulfilled' && smsResult.value?.queued;

  if (!emailQueued && !smsQueued) {
    throw new AppError('Failed to deliver delivery OTP', 500, 'OTP_DELIVERY_FAILED');
  }
};

module.exports = {
  sendSms,
  sendOtpNotification
};
