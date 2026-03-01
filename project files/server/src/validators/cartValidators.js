const { body } = require('express-validator');

const itemFields = [
  body('productId').isMongoId(),
  body('variantId').isMongoId(),
  body('quantity').isInt({ min: 1, max: 100 })
];

const removeItem = [body('productId').isMongoId(), body('variantId').isMongoId()];
const applyCoupon = [body('code').isString().trim().isLength({ min: 3, max: 30 }).toUpperCase()];

module.exports = { itemFields, removeItem, applyCoupon };
