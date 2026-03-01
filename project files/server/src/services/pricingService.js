const env = require('../config/env');
const couponService = require('./couponService');

const calculatePricingSummary = async ({ lines, userId, couponCode = '', categoryIds = [], session = null }) => {
  const totalMRP = Number(
    (lines || []).reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitMRP || 0), 0).toFixed(2)
  );
  const subtotal = Number((lines || []).reduce((sum, line) => sum + Number(line.lineTotal || 0), 0).toFixed(2));
  const totalDiscount = Number((totalMRP - subtotal).toFixed(2));

  const couponResult = await couponService.validateCoupon({
    code: couponCode,
    userId,
    subtotal,
    categoryIds,
    session
  });
  const couponDiscount = couponResult.valid ? Number(couponResult.discount.toFixed(2)) : 0;
  const deliveryFee = subtotal >= env.freeDeliveryThreshold ? 0 : env.defaultDeliveryFee;
  const taxableAmount = Math.max(0, subtotal - couponDiscount);
  const tax = Number(((taxableAmount * env.taxPercent) / 100).toFixed(2));
  const grandTotal = Number((taxableAmount + tax + deliveryFee).toFixed(2));

  return {
    subtotal,
    totalMRP,
    totalDiscount,
    couponResult,
    couponDiscount,
    deliveryFee,
    tax,
    grandTotal
  };
};

module.exports = {
  calculatePricingSummary
};
