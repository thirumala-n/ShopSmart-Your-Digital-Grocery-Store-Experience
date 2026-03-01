const asyncHandler = require('../utils/asyncHandler');
const wishlistService = require('../services/wishlistService');

const listWishlist = asyncHandler(async (req, res) => {
  const data = await wishlistService.listWishlist(req.auth.userId);
  res.status(200).json({
    success: true,
    data,
    items: data,
    total: data.length,
    page: 1,
    pageSize: data.length,
    totalPages: 1
  });
});

const addWishlistItem = asyncHandler(async (req, res) => {
  const data = await wishlistService.addWishlistItem({
    userId: req.auth.userId,
    productId: req.body.productId
  });
  res.status(200).json({ success: true, data });
});

const removeWishlistItem = asyncHandler(async (req, res) => {
  const data = await wishlistService.removeWishlistItem({
    userId: req.auth.userId,
    productId: req.body.productId
  });
  res.status(200).json({ success: true, data });
});

const subscribeStockAlert = asyncHandler(async (req, res) => {
  const data = await wishlistService.subscribeStockAlert({
    userId: req.auth.userId,
    productId: req.body.productId
  });
  res.status(200).json({ success: true, data });
});

module.exports = { listWishlist, addWishlistItem, removeWishlistItem, subscribeStockAlert };
