const { param } = require('express-validator');

const parentCategory = [param('parentId').isMongoId()];
const categorySlug = [param('slug').isString().trim().isLength({ min: 1, max: 240 })];

module.exports = {
  parentCategory,
  categorySlug
};
