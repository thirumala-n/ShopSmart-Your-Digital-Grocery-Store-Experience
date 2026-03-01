const { body, param } = require('express-validator');

const upsertProduct = [
  body('id').optional().isMongoId(),
  body('name').isString().trim().isLength({ min: 2, max: 180 }),
  body('slug').isString().trim().isLength({ min: 2, max: 200 }),
  body('SKU').isString().trim().isLength({ min: 2, max: 60 }),
  body('brand').isString().trim().isLength({ min: 2, max: 80 }),
  body('categoryId').isMongoId(),
  body('subCategoryId').isMongoId(),
  body('sellerId').optional().isMongoId(),
  body('description').optional().isString(),
  body('variants').isArray({ min: 1 }),
  body('variants.*.weight').isString().trim().isLength({ min: 1, max: 20 }),
  body('variants.*.price').isFloat({ min: 0 }),
  body('variants.*.MRP').isFloat({ min: 0 }),
  body('variants.*.stock').isInt({ min: 0 }),
  body('variants.*.skuSuffix').isString().trim().isLength({ min: 1, max: 40 })
];

const deleteById = [param('id').isMongoId()];

const upsertCategory = [
  body('id').optional().isMongoId(),
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('slug').isString().trim().isLength({ min: 2, max: 140 }),
  body('parentCategoryId').optional({ nullable: true }).isMongoId(),
  body('level').isInt({ min: 0, max: 3 }),
  body('displayOrder').isInt({ min: 0 }),
  body('isActive').optional().isBoolean()
];

const upsertCoupon = [
  body('id').optional().isMongoId(),
  body('code').isString().trim().isLength({ min: 3, max: 30 }).toUpperCase(),
  body('discountType').isIn(['FLAT', 'PERCENTAGE']),
  body('discountValue').isFloat({ min: 0 }),
  body('maxDiscount').optional().isFloat({ min: 0 }),
  body('minOrderValue').isFloat({ min: 0 }),
  body('totalUsageLimit').isInt({ min: 0 }),
  body('perUserLimit').isInt({ min: 1 }),
  body('validFrom').isISO8601(),
  body('expiryDate').isISO8601(),
  body('isActive').isBoolean()
];

const upsertBanner = [
  body('id').optional().isMongoId(),
  body('title').isString().trim().isLength({ min: 2, max: 140 }),
  body('subtitle').optional().isString().trim().isLength({ max: 200 }),
  body('imageUrl').isString().trim().isLength({ min: 3 }),
  body('ctaText').isString().trim().isLength({ min: 1, max: 40 }),
  body('ctaLink').isString().trim().isLength({ min: 1, max: 200 }),
  body('displayOrder').isInt({ min: 0 }),
  body('validFrom').isISO8601(),
  body('validTo').isISO8601(),
  body('isActive').isBoolean()
];

const upsertBrand = [
  body('id').optional().isMongoId(),
  body('name').isString().trim().isLength({ min: 2, max: 80 }),
  body('slug').isString().trim().isLength({ min: 2, max: 80 }),
  body('logoUrl').isString().trim(),
  body('isFeatured').optional().isBoolean(),
  body('isActive').optional().isBoolean()
];

const upsertBundleOffer = [
  body('id').optional().isMongoId(),
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('discountType').isIn(['FLAT', 'PERCENTAGE']),
  body('discountValue').isFloat({ min: 0 }),
  body('validFrom').isISO8601(),
  body('validTo').isISO8601(),
  body('isActive').isBoolean()
];

const upsertSeasonalSale = [
  body('id').optional().isMongoId(),
  body('campaignName').isString().trim().isLength({ min: 2, max: 120 }),
  body('discountPercent').isFloat({ min: 0, max: 90 }),
  body('bannerImageUrl').isString().trim(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('isActive').isBoolean()
];

const upsertPolicy = [
  body('key').isIn(['RETURN_REFUND_POLICY', 'DELIVERY_INFORMATION', 'CANCELLATION_POLICY', 'COOKIE_POLICY']),
  body('title').isString().trim().isLength({ min: 2, max: 140 }),
  body('contentHtml').isString().isLength({ min: 5 })
];

module.exports = {
  upsertProduct,
  deleteById,
  upsertCategory,
  upsertCoupon,
  upsertBanner,
  upsertBrand,
  upsertBundleOffer,
  upsertSeasonalSale,
  upsertPolicy
};
