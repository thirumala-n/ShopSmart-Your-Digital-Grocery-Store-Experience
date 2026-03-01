const asyncHandler = require('../utils/asyncHandler');
const categoryRepository = require('../repositories/categoryRepository');
const brandRepository = require('../repositories/brandRepository');

const listRootCategories = asyncHandler(async (req, res) => {
  const roots = await categoryRepository.listRootCategories();
  res.set('Cache-Control', 'public, max-age=300');
  res.status(200).json({
    success: true,
    data: roots,
    items: roots,
    total: roots.length,
    page: 1,
    pageSize: roots.length,
    totalPages: 1
  });
});

const listSubcategories = asyncHandler(async (req, res) => {
  const items = await categoryRepository.listByParent(req.params.parentId);
  res.set('Cache-Control', 'public, max-age=300');
  res.status(200).json({
    success: true,
    data: items,
    items,
    total: items.length,
    page: 1,
    pageSize: items.length,
    totalPages: 1
  });
});

const listFeaturedBrands = asyncHandler(async (req, res) => {
  const items = await brandRepository.listFeaturedActive({ limit: 20 });
  res.set('Cache-Control', 'public, max-age=300');
  res.status(200).json({
    success: true,
    data: items,
    items,
    total: items.length,
    page: 1,
    pageSize: items.length,
    totalPages: 1
  });
});

const getCategoryBySlug = asyncHandler(async (req, res) => {
  const data = await categoryRepository.findBySlug(req.params.slug);
  if (!data) {
    return res.status(404).json({ success: false, code: 'CATEGORY_NOT_FOUND', message: 'Category not found' });
  }
  return res.status(200).json({ success: true, data });
});

module.exports = { listRootCategories, listSubcategories, listFeaturedBrands, getCategoryBySlug };
