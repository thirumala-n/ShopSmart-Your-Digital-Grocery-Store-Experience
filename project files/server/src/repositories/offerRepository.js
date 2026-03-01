const BundleOffer = require('../models/BundleOffer');
const SeasonalSale = require('../models/SeasonalSale');
const Coupon = require('../models/Coupon');

const listActiveCoupons = (date = new Date()) =>
  Coupon.find({
    isActive: true,
    validFrom: { $lte: date },
    expiryDate: { $gte: date }
  })
    .select('code discountType discountValue maxDiscount minOrderValue expiryDate')
    .limit(20)
    .lean();

const listActiveBundles = (date = new Date()) =>
  BundleOffer.find({
    isActive: true,
    validFrom: { $lte: date },
    validTo: { $gte: date }
  })
    .limit(20)
    .lean();

const listActiveSales = (date = new Date()) =>
  SeasonalSale.find({
    isActive: true,
    startDate: { $lte: date },
    endDate: { $gte: date }
  })
    .limit(20)
    .lean();

const upsertBundle = (id, payload) =>
  id
    ? BundleOffer.findByIdAndUpdate(id, payload, { returnDocument: 'after' }).lean()
    : BundleOffer.create(payload);

const upsertSale = (id, payload) =>
  id
    ? SeasonalSale.findByIdAndUpdate(id, payload, { returnDocument: 'after' }).lean()
    : SeasonalSale.create(payload);

module.exports = {
  listActiveCoupons,
  listActiveBundles,
  listActiveSales,
  upsertBundle,
  upsertSale
};
