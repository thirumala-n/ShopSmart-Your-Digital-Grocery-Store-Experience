const express = require('express');
const catalogMetaController = require('../controllers/catalogMetaController');
const validate = require('../middleware/validate');
const catalogMetaValidators = require('../validators/catalogMetaValidators');

const router = express.Router();

router.get('/categories/root', catalogMetaController.listRootCategories);
router.get('/categories/by-slug/:slug', validate(catalogMetaValidators.categorySlug), catalogMetaController.getCategoryBySlug);
router.get(
  '/categories/:parentId/subcategories',
  validate(catalogMetaValidators.parentCategory),
  catalogMetaController.listSubcategories
);
router.get('/brands/featured', catalogMetaController.listFeaturedBrands);

module.exports = router;
