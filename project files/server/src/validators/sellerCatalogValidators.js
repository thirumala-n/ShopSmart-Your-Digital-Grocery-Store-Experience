const { body } = require('express-validator');

const upsertProduct = [
  body('id').optional().isMongoId(),
  body('name').isString().trim().isLength({ min: 2, max: 180 }),
  body('slug').isString().trim().isLength({ min: 2, max: 200 }),
  body('SKU').isString().trim().isLength({ min: 2, max: 60 }),
  body('brand').isString().trim().isLength({ min: 2, max: 80 }),
  body('categoryId').isMongoId(),
  body('subCategoryId').isMongoId(),
  body('description').optional().isString(),
  body('variants').isArray({ min: 1 }),
  body('variants.*.weight').isString().trim().isLength({ min: 1, max: 20 }),
  body('variants.*.price').isFloat({ min: 0 }),
  body('variants.*.MRP').isFloat({ min: 0 }),
  body('variants.*.stock').isInt({ min: 0 }),
  body('variants.*.skuSuffix').isString().trim().isLength({ min: 1, max: 40 })
];

const updateStock = [
  body('productId').isMongoId(),
  body('variantId').isMongoId(),
  body('stock').isInt({ min: 0 })
];

module.exports = { upsertProduct, updateStock };
