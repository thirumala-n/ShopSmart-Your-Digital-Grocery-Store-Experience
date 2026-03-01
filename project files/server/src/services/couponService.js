const AppError = require('../utils/AppError');
const couponRepository = require('../repositories/couponRepository');
const orderRepository = require('../repositories/orderRepository');

const validateCoupon = async ({ code, userId, subtotal, categoryIds = [], session = null }) => {
  if (!code) {
    return { valid: false, discount: 0, coupon: null, reason: 'Coupon code missing' };
  }

  const coupon = await couponRepository.findActiveByCode(code, session);
  if (!coupon) {
    return { valid: false, discount: 0, coupon: null, reason: 'Invalid coupon code' };
  }

  const now = new Date();
  if (now < coupon.validFrom || now > coupon.expiryDate) {
    return { valid: false, discount: 0, coupon: null, reason: 'Coupon expired or not started' };
  }
  if (coupon.totalUsageLimit > 0 && coupon.usedCount >= coupon.totalUsageLimit) {
    return { valid: false, discount: 0, coupon: null, reason: 'Coupon usage limit reached' };
  }
  if (subtotal < coupon.minOrderValue) {
    return { valid: false, discount: 0, coupon: null, reason: 'Minimum order value not met' };
  }

  const userUsage = (coupon.usedBy || []).find((entry) => String(entry.userId) === String(userId));
  if (userUsage && userUsage.usageCount >= coupon.perUserLimit) {
    return { valid: false, discount: 0, coupon: null, reason: 'Per-user coupon limit reached' };
  }

  if (coupon.applicableUserSegment === 'NEW_USERS') {
    const userOrdersCount = await orderRepository.countByUserId(userId);
    if (userOrdersCount > 0) {
      return { valid: false, discount: 0, coupon: null, reason: 'Coupon is for new users only' };
    }
  }
  if (
    coupon.applicableUserSegment === 'SPECIFIC' &&
    !(coupon.specificUserIds || []).some((id) => String(id) === String(userId))
  ) {
    return { valid: false, discount: 0, coupon: null, reason: 'Coupon not applicable for this user' };
  }

  if (coupon.applicableCategories?.length) {
    const hasApplicableCategory = categoryIds.some((categoryId) =>
      coupon.applicableCategories.some((allowed) => String(allowed) === String(categoryId))
    );
    if (!hasApplicableCategory) {
      return { valid: false, discount: 0, coupon: null, reason: 'Coupon not applicable for selected products' };
    }
  }

  let discount = 0;
  if (coupon.discountType === 'FLAT') {
    discount = Math.min(coupon.discountValue, subtotal);
  } else {
    discount = (subtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  }

  return { valid: true, discount: Number(discount.toFixed(2)), coupon };
};

const markCouponUsed = async ({ coupon, userId, session = null }) => {
  if (!coupon) return null;
  await couponRepository.incrementUsage({ coupon, userId, session });
  return coupon;
};

const assertCouponValid = async (payload) => {
  const result = await validateCoupon(payload);
  if (!result.valid) {
    throw new AppError(result.reason || 'Invalid coupon', 400, 'COUPON_INVALID');
  }
  return result;
};

module.exports = {
  validateCoupon,
  markCouponUsed,
  assertCouponValid
};
