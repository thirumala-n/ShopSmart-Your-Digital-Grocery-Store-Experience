const AppError = require('../utils/AppError');
const catalogAdminRepository = require('../repositories/catalogAdminRepository');
const inventoryService = require('./inventoryService');
const stockMovementRepository = require('../repositories/stockMovementRepository');

const upsertProduct = async (payload, user) => {
  const base = {
    ...payload,
    adminApproved: true,
    sellerId: payload.sellerId || user.userId
  };
  if (payload.id) {
    const updated = await catalogAdminRepository.upsertProduct({ ...base, id: payload.id });
    if (!updated) throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    return updated;
  }
  return catalogAdminRepository.upsertProduct(base);
};

const deleteProduct = (id) => catalogAdminRepository.deleteProductById(id);

const upsertCategory = (payload) => catalogAdminRepository.upsertCategory(payload);

const deleteCategory = async (id) => {
  const hasProducts = await catalogAdminRepository.categoryHasProducts(id);
  if (hasProducts) {
    throw new AppError('Category has assigned products; reassign before deletion', 400, 'CATEGORY_HAS_PRODUCTS');
  }
  await catalogAdminRepository.deleteCategoryById(id);
};

const upsertCoupon = (payload) => catalogAdminRepository.upsertCoupon(payload);

const upsertBanner = (payload) => catalogAdminRepository.upsertBanner(payload);

const upsertBrand = (payload) => catalogAdminRepository.upsertBrand(payload);

const upsertBundleOffer = (payload) => catalogAdminRepository.upsertBundleOffer(payload);

const upsertSeasonalSale = (payload) => catalogAdminRepository.upsertSeasonalSale(payload);

const upsertPolicyContent = (payload) => catalogAdminRepository.upsertPolicyContent(payload);

const updateVariantStock = async ({ productId, variantId, stock, performedBy, reason = 'ADMIN_MANUAL_STOCK_UPDATE' }) =>
  inventoryService.withTransaction(async (session) => {
    const product = await catalogAdminRepository.getProductByIdForUpdate(productId, session);
    if (!product) throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    const variant = (product.variants || []).find((entry) => String(entry.variantId) === String(variantId));
    if (!variant) throw new AppError('Variant not found', 404, 'VARIANT_NOT_FOUND');
    const delta = Number(stock) - Number(variant.stock);
    variant.stock = Number(stock);
    await product.save({ session });
    await stockMovementRepository.createMovement(
      {
        productId: product._id,
        variantId: variant.variantId,
        delta,
        reason,
        referenceOrderId: null,
        performedBy
      },
      session
    );
    return product.toObject();
  });

const updateLowStockThreshold = async ({ productId, threshold }) => {
  const updated = await catalogAdminRepository.setLowStockThreshold(productId, threshold);
  if (!updated) throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
  return updated;
};

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
  upsertPolicyContent,
  updateVariantStock,
  updateLowStockThreshold
};
