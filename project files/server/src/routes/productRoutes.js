const express = require('express');
const productController = require('../controllers/productController');
const validate = require('../middleware/validate');
const productValidators = require('../validators/productValidators');

const router = express.Router();

router.get('/banners/home', productController.listHomeBanners);
router.get('/', validate(productValidators.listProducts), productController.listProducts);
router.get('/by-id/:id', validate(productValidators.getById), productController.getProductById);
router.get('/:slug', validate(productValidators.getBySlug), productController.getProductBySlug);

module.exports = router;
