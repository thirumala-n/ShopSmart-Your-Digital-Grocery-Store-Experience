const asyncHandler = require('../utils/asyncHandler');
const catalogAdminService = require('../services/catalogAdminService');
const auditLogService = require('../services/auditLogService');

const upsertProduct = asyncHandler(async (req, res) => {
  const data = await catalogAdminService.upsertProduct(req.body, req.auth);
  res.status(200).json({ success: true, data });
});

const deleteProduct = asyncHandler(async (req, res) => {
  await catalogAdminService.deleteProduct(req.params.id);
  res.status(200).json({ success: true, message: 'Product deleted' });
});

const upsertCategory = asyncHandler(async (req, res) => {
  const data = await catalogAdminService.upsertCategory(req.body);
  res.status(200).json({ success: true, data });
});

const deleteCategory = asyncHandler(async (req, res) => {
  await catalogAdminService.deleteCategory(req.params.id);
  res.status(200).json({ success: true, message: 'Category deleted' });
});

const upsertCoupon = asyncHandler(async (req, res) => {
  const data = await catalogAdminService.upsertCoupon(req.body);
  await auditLogService.createAuditLog({
    action: 'COUPON_UPSERT',
    performedBy: req.auth.userId,
    targetType: 'COUPON',
    targetId: data?._id || req.body.id || req.body.code || 'unknown',
    previousValue: null,
    newValue: data,
    req
  });
  res.status(200).json({ success: true, data });
});

const upsertBanner = asyncHandler(async (req, res) => {
  const data = await catalogAdminService.upsertBanner(req.body);
  await auditLogService.createAuditLog({
    action: 'BANNER_UPSERT',
    performedBy: req.auth.userId,
    targetType: 'BANNER',
    targetId: data?._id || req.body.id || req.body.title || 'unknown',
    previousValue: null,
    newValue: data,
    req
  });
  res.status(200).json({ success: true, data });
});

const upsertBrand = asyncHandler(async (req, res) => {
  const data = await catalogAdminService.upsertBrand(req.body);
  res.status(200).json({ success: true, data });
});

const upsertBundleOffer = asyncHandler(async (req, res) => {
  const data = await catalogAdminService.upsertBundleOffer(req.body);
  res.status(200).json({ success: true, data });
});

const upsertSeasonalSale = asyncHandler(async (req, res) => {
  const data = await catalogAdminService.upsertSeasonalSale(req.body);
  res.status(200).json({ success: true, data });
});

const upsertPolicyContent = asyncHandler(async (req, res) => {
  const data = await catalogAdminService.upsertPolicyContent({
    ...req.body,
    updatedBy: req.auth.userId
  });
  res.status(200).json({ success: true, data });
});

module.exports = {
  upsertProduct,
  deleteProduct,
  upsertCategory,
  deleteCategory,
  upsertCoupon,
  upsertBanner,
  upsertBrand,
  upsertBundleOffer,
  upsertSeasonalSale,
  upsertPolicyContent
};
