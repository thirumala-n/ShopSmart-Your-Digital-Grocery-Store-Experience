const AppError = require('../utils/AppError');
const inventoryService = require('./inventoryService');
const sellerCatalogRepository = require('../repositories/sellerCatalogRepository');

const listSellerProducts = async (sellerId, page, pageSize, skip) => {
  const [items, total] = await Promise.all([
    sellerCatalogRepository.listSellerProducts(sellerId, pageSize, skip),
    sellerCatalogRepository.countSellerProducts(sellerId)
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
};

const upsertSellerProduct = async (sellerId, payload) => {
  const base = {
    ...payload,
    sellerId
  };
  if (payload.id) {
    const existing = await sellerCatalogRepository.findSellerProductById({ sellerId, productId: payload.id });
    if (!existing) throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    Object.assign(existing, base, {
      adminApproved: existing.adminApproved,
      isActive: existing.isActive,
      adminReviewNote: existing.adminReviewNote || ''
    });
    await sellerCatalogRepository.saveProduct(existing);
    return existing.toObject();
  }
  return sellerCatalogRepository.createSellerProduct({
    ...base,
    adminApproved: false,
    isActive: false,
    adminReviewNote: ''
  });
};

const updateSellerStock = async ({ sellerId, productId, variantId, stock, performedBy }) => {
  return inventoryService.withTransaction(async (session) => {
    const product = await sellerCatalogRepository.findSellerProductByIdForUpdate({ sellerId, productId, session });
    if (!product) throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    const variant = product.variants.find((v) => String(v.variantId) === String(variantId));
    if (!variant) throw new AppError('Variant not found', 404, 'VARIANT_NOT_FOUND');
    const delta = stock - variant.stock;
    variant.stock = stock;
    await sellerCatalogRepository.saveProduct(product, session);
    await sellerCatalogRepository.createStockMovement(
      {
        productId,
        variantId,
        delta,
        reason: 'SELLER_MANUAL_UPDATE',
        referenceOrderId: null,
        performedBy
      },
      session
    );
    return product.toObject();
  });
};

module.exports = {
  listSellerProducts,
  upsertSellerProduct,
  updateSellerStock
};
