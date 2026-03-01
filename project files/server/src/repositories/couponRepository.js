const Coupon = require('../models/Coupon');

const findActiveByCode = (code, session = null) =>
  Coupon.findOne({ code: String(code || '').toUpperCase(), isActive: true }, null, { session });

const incrementUsage = async ({ coupon, userId, session }) => {
  coupon.usedCount += 1;
  const usage = coupon.usedBy.find((entry) => String(entry.userId) === String(userId));
  if (usage) {
    usage.usageCount += 1;
  } else {
    coupon.usedBy.push({ userId, usageCount: 1 });
  }
  await coupon.save({ session });
  return coupon;
};

module.exports = {
  findActiveByCode,
  incrementUsage
};
