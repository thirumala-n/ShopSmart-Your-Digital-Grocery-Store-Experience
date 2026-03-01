const asyncHandler = require('../utils/asyncHandler');
const { getPagination } = require('../utils/pagination');
const sellerCatalogService = require('../services/sellerCatalogService');

const listProducts = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const data = await sellerCatalogService.listSellerProducts(req.auth.userId, page, pageSize, skip);
  res.status(200).json({ success: true, ...data });
});

const upsertProduct = asyncHandler(async (req, res) => {
  const data = await sellerCatalogService.upsertSellerProduct(req.auth.userId, req.body);
  res.status(200).json({ success: true, data });
});

const updateStock = asyncHandler(async (req, res) => {
  const data = await sellerCatalogService.updateSellerStock({
    sellerId: req.auth.userId,
    productId: req.body.productId,
    variantId: req.body.variantId,
    stock: req.body.stock,
    performedBy: req.auth.userId
  });
  res.status(200).json({ success: true, data });
});

module.exports = { listProducts, upsertProduct, updateStock };
