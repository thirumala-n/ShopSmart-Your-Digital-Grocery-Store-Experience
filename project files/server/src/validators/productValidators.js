const { param, query } = require('express-validator');

const listProducts = [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('categoryId').optional().isMongoId(),
  query('subCategoryId').optional().isMongoId(),
  query('brand').optional().isString().trim().isLength({ min: 1, max: 120 }),
  query('search').optional().isString().trim().isLength({ min: 1, max: 120 }),
  query('sellerId').optional().isMongoId(),
  query('sortBy').optional().isIn(['relevance', 'price_asc', 'price_desc', 'popularity', 'newest', 'discount_desc']),
  query('isFeatured').optional().isIn(['true', 'false']),
  query('discountMin').optional().isInt({ min: 0, max: 100 }),
  query('minRating').optional().isFloat({ min: 0, max: 5 }),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('inStock').optional().isIn(['true', 'false'])
];

const getBySlug = [param('slug').isString().trim().isLength({ min: 1, max: 240 })];
const getById = [param('id').isMongoId()];

module.exports = {
  listProducts,
  getBySlug,
  getById
};
