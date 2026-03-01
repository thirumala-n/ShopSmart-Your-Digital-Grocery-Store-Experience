const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

const sanitizeText = (value, maxLength = 80) => String(value || '')
  .replace(/[^\w\s\-.,]/g, ' ')
  .trim()
  .slice(0, maxLength);

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

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

const baseProductSelect = '_id name sellerId brand image category description price discountPercentage stock ratingAverage ratingCount soldCount createdAt';

const getSortStage = (sort) => {
  const normalized = String(sort || '').toLowerCase();
  if (normalized === 'price_asc') {
    return { price: 1, _id: -1 };
  }
  if (normalized === 'price_desc') {
    return { price: -1, _id: -1 };
  }
  if (normalized === 'rating_desc') {
    return { ratingAverage: -1, ratingCount: -1, _id: -1 };
  }
  if (normalized === 'popular_desc') {
    return { soldCount: -1, ratingAverage: -1, _id: -1 };
  }
  return { createdAt: -1, _id: -1 };
};

const getFilters = (query) => {
  const filters = { isAvailable: true };
  const search = sanitizeText(query.search, 120);
  const category = String(query.category || '').trim();
  const brand = sanitizeText(query.brand, 50);
  const minPrice = toFiniteNumber(query.minPrice);
  const maxPrice = toFiniteNumber(query.maxPrice);
  const minRating = toFiniteNumber(query.minRating);
  const availability = String(query.availability || '').trim().toLowerCase();

  if (search) {
    const safeSearch = escapeRegex(search);
    filters.$or = [
      { name: { $regex: safeSearch, $options: 'i' } },
      { description: { $regex: safeSearch, $options: 'i' } },
      { brand: { $regex: safeSearch, $options: 'i' } }
    ];
  }

  if (mongoose.isValidObjectId(category)) {
    filters.category = category;
  }

  if (brand) {
    filters.brand = { $regex: `^${escapeRegex(brand)}$`, $options: 'i' };
  }

  if (minPrice !== null || maxPrice !== null) {
    filters.price = {};
    if (minPrice !== null) {
      filters.price.$gte = Math.max(0, minPrice);
    }
    if (maxPrice !== null) {
      filters.price.$lte = Math.max(0, maxPrice);
    }
  }

  if (minRating !== null) {
    filters.ratingAverage = { $gte: Math.max(0, minRating) };
  }

  if (availability === 'in_stock') {
    filters.stock = { $gt: 0 };
  }

  return filters;
};

const addDerivedPricing = (products) => products.map((product) => ({
  ...product,
  discountedPrice: Number(
    (Number(product.price || 0) * (1 - Number(product.discountPercentage || 0) / 100)).toFixed(2)
  )
}));

const getFeaturedProducts = async (featured, limit, userId) => {
  if (featured === 'bestsellers') {
    const items = await Product.find({ isAvailable: true, stock: { $gt: 0 } })
      .select(baseProductSelect)
      .sort({ soldCount: -1, ratingAverage: -1, _id: -1 })
      .limit(limit)
      .lean();
    return addDerivedPricing(items);
  }

  if (featured === 'recommended') {
    const items = await Product.find({
      isAvailable: true,
      stock: { $gt: 0 },
      ratingAverage: { $gte: 4 }
    })
      .select(baseProductSelect)
      .sort({ ratingAverage: -1, soldCount: -1, _id: -1 })
      .limit(limit)
      .lean();
    return addDerivedPricing(items);
  }

  if (featured === 'deals') {
    const items = await Product.find({
      isAvailable: true,
      stock: { $gt: 0 },
      discountPercentage: { $gt: 0 }
    })
      .select(baseProductSelect)
      .sort({ discountPercentage: -1, soldCount: -1, _id: -1 })
      .limit(limit)
      .lean();
    return addDerivedPricing(items);
  }

  if (featured === 'personalized' && mongoose.isValidObjectId(userId)) {
    const userHistory = await Order.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          score: { $sum: '$items.quantity' }
        }
      },
      { $sort: { score: -1 } },
      { $limit: 3 }
    ]);

    const categoryIds = userHistory.map((item) => item._id).filter(Boolean);
    const purchasedIds = await Order.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId' } }
    ]);

    const excludeIds = purchasedIds.map((item) => item._id);
    const items = await Product.find({
      isAvailable: true,
      stock: { $gt: 0 },
      category: { $in: categoryIds },
      _id: { $nin: excludeIds },
      ratingAverage: { $gte: 3.5 }
    })
      .select(baseProductSelect)
      .sort({ ratingAverage: -1, soldCount: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return addDerivedPricing(items);
  }

  return null;
};

const getAllProducts = async (req, res, next) => {
  try {
    const pagination = parsePagination(req);
    if (pagination.error) {
      return res.status(400).json({ message: pagination.error });
    }

    const { page, limit } = pagination;
    const featured = String(req.query.featured || '').trim().toLowerCase();
    const featuredItems = await getFeaturedProducts(featured, limit, String(req.query.userId || '').trim());
    if (featuredItems) {
      return res.status(200).json(featuredItems);
    }

    const filters = getFilters(req.query);
    const sortStage = getSortStage(req.query.sort);

    const [items, total] = await Promise.all([
      Product.find(filters)
        .select(baseProductSelect)
        .sort(sortStage)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('category', 'name')
        .lean(),
      Product.countDocuments(filters)
    ]);

    return res.status(200).json({
      items: addDerivedPricing(items),
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

const getProductById = async (req, res, next) => {
  try {
    const includeInsights = String(req.query.includeInsights || 'false').toLowerCase() === 'true';
    const userId = String(req.query.userId || '').trim();

    const product = await Product.findById(req.params.id)
      .select(`${baseProductSelect} reviews`)
      .populate('category', 'name')
      .lean();

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Product.updateOne({ _id: product._id }, { $inc: { viewsCount: 1 } });

    const mappedProduct = addDerivedPricing([product])[0];
    if (!includeInsights) {
      return res.status(200).json(mappedProduct);
    }

    const frequentlyBoughtTogetherIds = await Order.aggregate([
      { $match: { 'items.productId': new mongoose.Types.ObjectId(product._id) } },
      { $unwind: '$items' },
      {
        $match: {
          'items.productId': { $ne: new mongoose.Types.ObjectId(product._id) }
        }
      },
      {
        $group: {
          _id: '$items.productId',
          score: { $sum: '$items.quantity' }
        }
      },
      { $sort: { score: -1 } },
      { $limit: 6 }
    ]);

    const fbtIds = frequentlyBoughtTogetherIds.map((item) => item._id);
    const [relatedProducts, frequentlyBoughtTogether, recommendedForUser] = await Promise.all([
      Product.find({
        _id: { $ne: product._id },
        category: product.category?._id || product.category,
        isAvailable: true,
        stock: { $gt: 0 }
      })
        .select(baseProductSelect)
        .sort({ ratingAverage: -1, soldCount: -1, _id: -1 })
        .limit(8)
        .populate('category', 'name')
        .lean(),
      Product.find({
        _id: { $in: fbtIds },
        isAvailable: true
      })
        .select(baseProductSelect)
        .limit(8)
        .populate('category', 'name')
        .lean(),
      getFeaturedProducts('personalized', 8, userId)
    ]);

    return res.status(200).json({
      product: mappedProduct,
      relatedProducts: addDerivedPricing(relatedProducts),
      frequentlyBoughtTogether: addDerivedPricing(frequentlyBoughtTogether),
      recommendedForUser: Array.isArray(recommendedForUser) ? recommendedForUser : []
    });
  } catch (error) {
    return next(error);
  }
};

const getSuggestions = async (req, res, next) => {
  try {
    const query = sanitizeText(req.query.q, 60);
    if (!query || query.length < 2) {
      return res.status(200).json([]);
    }
    const safeQuery = escapeRegex(query);

    const suggestions = await Product.find({
      $or: [
        { name: { $regex: safeQuery, $options: 'i' } },
        { brand: { $regex: safeQuery, $options: 'i' } }
      ],
      isAvailable: true,
      stock: { $gt: 0 }
    })
      .select('_id name brand image price discountPercentage')
      .sort({ soldCount: -1, ratingAverage: -1, _id: -1 })
      .limit(8)
      .lean();

    return res.status(200).json(addDerivedPricing(suggestions));
  } catch (error) {
    return next(error);
  }
};

const addReview = async (req, res, next) => {
  try {
    const rating = Number(req.body?.rating);
    const comment = sanitizeText(req.body?.comment, 500);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'rating must be an integer between 1 and 5' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const reviewIndex = product.reviews.findIndex((review) => String(review.userId) === String(req.user._id));
    if (reviewIndex >= 0) {
      product.reviews[reviewIndex].rating = rating;
      product.reviews[reviewIndex].comment = comment;
    } else {
      product.reviews.push({
        userId: req.user._id,
        userName: String(req.user.name || 'Customer').trim(),
        rating,
        comment
      });
    }

    const reviewTotal = product.reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    product.ratingCount = product.reviews.length;
    product.ratingAverage = product.ratingCount ? Number((reviewTotal / product.ratingCount).toFixed(2)) : 0;
    await product.save();

    const responseProduct = await Product.findById(product._id)
      .select(`${baseProductSelect} reviews`)
      .populate('category', 'name')
      .lean();

    return res.status(200).json({
      message: 'Review submitted successfully',
      product: addDerivedPricing([responseProduct])[0]
    });
  } catch (error) {
    return next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      category,
      description,
      price,
      stock,
      image,
      images,
      brand,
      discountPercentage,
      tags,
      isAvailable
    } = req.body;

    if (!String(name || '').trim() || !mongoose.isValidObjectId(category)) {
      return res.status(400).json({ message: 'Valid name and category are required' });
    }
    if (!Number.isFinite(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ message: 'price must be a non-negative number' });
    }
    if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
      return res.status(400).json({ message: 'stock must be a non-negative integer' });
    }

    const product = await Product.create({
      name: sanitizeText(name, 120),
      sellerId: req.user._id,
      category,
      description: sanitizeText(description, 1000),
      price: Number(price),
      stock: Number(stock),
      image: String(image || '').trim(),
      images: Array.isArray(images) ? images.map((item) => String(item || '').trim()).filter(Boolean) : [],
      brand: sanitizeText(brand || 'Generic', 50),
      discountPercentage: Math.max(0, Math.min(90, Number(discountPercentage || 0))),
      tags: Array.isArray(tags) ? tags.map((item) => sanitizeText(item, 30)).filter(Boolean) : [],
      isAvailable: typeof isAvailable === 'boolean' ? isAvailable : true
    });

    const created = await Product.findById(product._id)
      .select(baseProductSelect)
      .populate('category', 'name')
      .lean();
    return res.status(201).json(addDerivedPricing([created])[0]);
  } catch (error) {
    return next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (payload.name !== undefined) {
      payload.name = sanitizeText(payload.name, 120);
    }
    if (payload.description !== undefined) {
      payload.description = sanitizeText(payload.description, 1000);
    }
    if (payload.brand !== undefined) {
      payload.brand = sanitizeText(payload.brand, 50);
    }
    if (payload.price !== undefined) {
      payload.price = Number(payload.price);
    }
    if (payload.stock !== undefined) {
      payload.stock = Number(payload.stock);
    }
    if (payload.discountPercentage !== undefined) {
      payload.discountPercentage = Math.max(0, Math.min(90, Number(payload.discountPercentage)));
    }

    const product = await Product.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    })
      .select(baseProductSelect)
      .populate('category', 'name')
      .lean();

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.status(200).json(addDerivedPricing([product])[0]);
  } catch (error) {
    return next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id).select('_id').lean();
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

const getSellerProducts = async (req, res, next) => {
  try {
    const sellerId = req.user._id;
    const parsed = parsePagination(req);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }
    const { page, limit } = parsed;

    const query = { sellerId };
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .select(baseProductSelect)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      products: addDerivedPricing(products),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return next(error);
  }
};

const updateSellerProduct = async (req, res, next) => {
  try {
    const sellerId = req.user._id;
    const productId = req.params.id;

    // First check if the product belongs to the seller
    const existingProduct = await Product.findOne({ _id: productId, sellerId }).select('_id').lean();
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found or access denied' });
    }

    const payload = { ...req.body };
    if (payload.name !== undefined) {
      payload.name = sanitizeText(payload.name, 120);
    }
    if (payload.description !== undefined) {
      payload.description = sanitizeText(payload.description, 1000);
    }
    if (payload.brand !== undefined) {
      payload.brand = sanitizeText(payload.brand, 50);
    }
    if (payload.price !== undefined) {
      payload.price = Number(payload.price);
    }
    if (payload.stock !== undefined) {
      payload.stock = Number(payload.stock);
    }
    if (payload.discountPercentage !== undefined) {
      payload.discountPercentage = Math.max(0, Math.min(90, Number(payload.discountPercentage)));
    }

    const product = await Product.findByIdAndUpdate(productId, payload, {
      new: true,
      runValidators: true
    })
      .select(baseProductSelect)
      .populate('category', 'name')
      .lean();

    return res.status(200).json(addDerivedPricing([product])[0]);
  } catch (error) {
    return next(error);
  }
};

const deleteSellerProduct = async (req, res, next) => {
  try {
    const sellerId = req.user._id;
    const productId = req.params.id;

    const product = await Product.findOneAndDelete({ _id: productId, sellerId }).select('_id').lean();
    if (!product) {
      return res.status(404).json({ message: 'Product not found or access denied' });
    }
    return res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  getSuggestions,
  addReview,
  createProduct,
  updateProduct,
  deleteProduct,
  getSellerProducts,
  updateSellerProduct,
  deleteSellerProduct
};
