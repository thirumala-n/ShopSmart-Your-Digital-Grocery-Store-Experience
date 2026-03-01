const asyncHandler = require('../utils/asyncHandler');
const { getPagination } = require('../utils/pagination');
const productRepository = require('../repositories/productRepository');
const bannerRepository = require('../repositories/bannerRepository');

const listProducts = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const data = await productRepository.listProducts({
    filters: {
      categoryId: req.query.categoryId,
      subCategoryId: req.query.subCategoryId,
      brand: req.query.brand,
      search: req.query.search,
      isFeatured: req.query.isFeatured === 'true' ? true : undefined,
      sellerId: req.query.sellerId,
      discountMin: req.query.discountMin ? Number(req.query.discountMin) : undefined,
      minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      inStock: req.query.inStock === 'true' ? true : undefined
    },
    sortBy: req.query.sortBy,
    page,
    pageSize,
    skip
  });
  res.set('Cache-Control', 'public, max-age=300');
  res.status(200).json({ success: true, ...data });
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const projection = {
    name: 1,
    slug: 1,
    SKU: 1,
    brand: 1,
    variants: 1,
    rating: 1,
    totalReviews: 1,
    images: 1,
    description: 1,
    tags: 1,
    categoryId: 1,
    subCategoryId: 1
  };

  let item = await productRepository.findProductBySlug(req.params.slug, projection);

  // Fallback: if slug not found, try treating slug as MongoId
  if (!item && req.params.slug.match(/^[0-9a-fA-F]{24}$/)) {
    item = await productRepository.findProductById(req.params.slug, projection);
  }

  if (!item) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Product not found' });
  }
  return res.status(200).json({ success: true, data: item });
});

const listHomeBanners = asyncHandler(async (req, res) => {
  const data = await bannerRepository.listActiveBanners(new Date());
  res.set('Cache-Control', 'public, max-age=300');
  res.status(200).json({ success: true, data });
});

const getProductById = asyncHandler(async (req, res) => {
  const item = await productRepository.findProductById(req.params.id, {
    name: 1,
    slug: 1,
    SKU: 1,
    brand: 1,
    variants: 1,
    rating: 1,
    totalReviews: 1,
    images: 1,
    description: 1,
    tags: 1,
    categoryId: 1,
    subCategoryId: 1
  });
  if (!item) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Product not found' });
  }
  return res.status(200).json({ success: true, data: item });
});

module.exports = {
  listProducts,
  getProductBySlug,
  getProductById,
  listHomeBanners
};
