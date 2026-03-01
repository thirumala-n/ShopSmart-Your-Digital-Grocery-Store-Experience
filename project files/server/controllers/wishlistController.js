const mongoose = require('mongoose');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

const parsePagination = (req) => {
  const pageRaw = req.query.page;
  const limitRaw = req.query.limit;
  const page = pageRaw === undefined ? 1 : Number(pageRaw);
  const limit = limitRaw === undefined ? DEFAULT_PAGE_SIZE : Number(limitRaw);

  if (!Number.isInteger(page) || page < 1) {
    return { error: 'Invalid page. page must be a positive integer.' };
  }

  if (!Number.isInteger(limit) || limit < 1) {
    return { error: 'Invalid limit. limit must be a positive integer.' };
  }

  if (limit > MAX_PAGE_SIZE) {
    return { error: `Invalid limit. Maximum page size is ${MAX_PAGE_SIZE}.` };
  }

  return { page, limit };
};

const sanitizeObjectId = (value) => {
  const input = String(value || '').trim();
  return mongoose.isValidObjectId(input) ? input : null;
};

const getWishlist = async (req, res, next) => {
  try {
    const pagination = parsePagination(req);
    if (pagination.error) {
      return res.status(400).json({ message: pagination.error });
    }

    const { page, limit } = pagination;
    const wishlist = await Wishlist.findOne({ userId: req.user._id })
      .select('products')
      .lean();

    const productIds = Array.isArray(wishlist?.products) ? wishlist.products.map((id) => String(id)) : [];
    const total = productIds.length;
    const start = (page - 1) * limit;
    const idsPage = productIds.slice(start, start + limit);

    if (!idsPage.length) {
      return res.status(200).json({
        items: [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit))
        }
      });
    }

    const products = await Product.find({ _id: { $in: idsPage } })
      .select('_id name brand image price discountPercentage ratingAverage ratingCount stock')
      .lean();

    const productsById = new Map(products.map((product) => [String(product._id), product]));
    const ordered = idsPage
      .map((id) => productsById.get(String(id)))
      .filter(Boolean)
      .map((product) => ({
        ...product,
        discountedPrice: Number((Number(product.price || 0) * (1 - Number(product.discountPercentage || 0) / 100)).toFixed(2))
      }));

    return res.status(200).json({
      items: ordered,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    return next(error);
  }
};

const getWishlistIds = async (req, res, next) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.user._id })
      .select('products')
      .lean();

    const ids = Array.isArray(wishlist?.products) ? wishlist.products.map((id) => String(id)) : [];
    return res.status(200).json({ ids });
  } catch (error) {
    return next(error);
  }
};

const toggleWishlist = async (req, res, next) => {
  try {
    const productId = sanitizeObjectId(req.body?.productId);
    if (!productId) {
      return res.status(400).json({ message: 'Valid productId is required' });
    }

    const productExists = await Product.exists({ _id: productId });
    if (!productExists) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const existing = await Wishlist.findOne({ userId: req.user._id })
      .select('products')
      .lean();

    const existsInWishlist = Array.isArray(existing?.products)
      && existing.products.some((id) => String(id) === String(productId));

    if (existsInWishlist) {
      await Wishlist.updateOne(
        { userId: req.user._id },
        { $pull: { products: productId } }
      );
      return res.status(200).json({ productId, inWishlist: false });
    }

    await Wishlist.updateOne(
      { userId: req.user._id },
      { $addToSet: { products: productId } },
      { upsert: true }
    );

    return res.status(200).json({ productId, inWishlist: true });
  } catch (error) {
    return next(error);
  }
};

const removeFromWishlist = async (req, res, next) => {
  try {
    const productId = sanitizeObjectId(req.params.productId);
    if (!productId) {
      return res.status(400).json({ message: 'Valid productId is required' });
    }

    await Wishlist.updateOne(
      { userId: req.user._id },
      { $pull: { products: productId } }
    );

    return res.status(200).json({ productId, inWishlist: false });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getWishlist,
  getWishlistIds,
  toggleWishlist,
  removeFromWishlist
};
