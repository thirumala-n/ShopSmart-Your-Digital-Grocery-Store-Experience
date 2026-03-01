const { body } = require('express-validator');

const item = [body('productId').isMongoId()];

module.exports = { item };
