const Cart = require('../models/Cart');
const Product = require('../models/Product');
const mongoose = require('mongoose');

const getValidQuantity = (value) => {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
};

const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId').lean();

    if (!cart) {
      const created = await Cart.create({ userId: req.user._id, items: [] });
      cart = await Cart.findById(created._id).populate('items.productId').lean();
    }

    return res.status(200).json(cart);
  } catch (error) {
    return next(error);
  }
};

const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const parsedQuantity = getValidQuantity(quantity);

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: 'productId is required' });
    }

    if (!parsedQuantity) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    const product = await Product.findById(productId).select('_id stock').lean();
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = new Cart({ userId: req.user._id, items: [] });
    }

    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);

    if (itemIndex > -1) {
      const nextQuantity = cart.items[itemIndex].quantity + parsedQuantity;
      if (nextQuantity > product.stock) {
        return res.status(400).json({ message: 'Requested quantity exceeds available stock' });
      }
      cart.items[itemIndex].quantity = nextQuantity;
    } else {
      if (parsedQuantity > product.stock) {
        return res.status(400).json({ message: 'Requested quantity exceeds available stock' });
      }
      cart.items.push({ productId, quantity: parsedQuantity });
    }

    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.productId').lean();
    return res.status(200).json(populatedCart);
  } catch (error) {
    return next(error);
  }
};

const updateQuantity = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const parsedQuantity = getValidQuantity(quantity);

    if (!parsedQuantity) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: 'productId is required' });
    }

    const product = await Product.findById(productId).select('_id stock').lean();
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (parsedQuantity > product.stock) {
      return res.status(400).json({ message: 'Requested quantity exceeds available stock' });
    }

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const item = cart.items.find((cartItem) => cartItem.productId.toString() === productId);
    if (!item) {
      return res.status(404).json({ message: 'Product not found in cart' });
    }

    item.quantity = parsedQuantity;
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.productId').lean();
    return res.status(200).json(populatedCart);
  } catch (error) {
    return next(error);
  }
};

const removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: 'productId is required' });
    }

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter((item) => item.productId.toString() !== productId);
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.productId').lean();
    return res.status(200).json(populatedCart);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCart,
  addToCart,
  updateQuantity,
  removeFromCart
};
