const asyncHandler = require('../utils/asyncHandler');
const cartService = require('../services/cartService');

const getCart = asyncHandler(async (req, res) => {
  const data = await cartService.getCart({ userId: req.auth.userId });
  res.status(200).json({ success: true, data });
});

const addItem = asyncHandler(async (req, res) => {
  const data = await cartService.addItem({ userId: req.auth.userId, ...req.body });
  res.status(200).json({ success: true, data });
});

const updateItem = asyncHandler(async (req, res) => {
  const data = await cartService.updateQty({ userId: req.auth.userId, ...req.body });
  res.status(200).json({ success: true, data });
});

const removeItem = asyncHandler(async (req, res) => {
  const data = await cartService.removeItem({ userId: req.auth.userId, ...req.body });
  res.status(200).json({ success: true, data });
});

const applyCoupon = asyncHandler(async (req, res) => {
  const data = await cartService.applyCoupon({ userId: req.auth.userId, code: req.body.code });
  res.status(200).json({ success: true, data });
});

const clearCoupon = asyncHandler(async (req, res) => {
  const data = await cartService.clearCoupon({ userId: req.auth.userId });
  res.status(200).json({ success: true, data });
});

module.exports = { getCart, addItem, updateItem, removeItem, applyCoupon, clearCoupon };
