const express = require('express');
const {
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
} = require('../controllers/productController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.get('/suggestions', getSuggestions);
router.get('/', getAllProducts);

// Admin routes
router.post('/', auth, authorize('ADMIN'), createProduct);
router.put('/:id', auth, authorize('ADMIN'), updateProduct);
router.delete('/:id', auth, authorize('ADMIN'), deleteProduct);

// Seller routes
router.get('/seller/my-products', auth, authorize('SELLER'), getSellerProducts);
router.post('/seller/create', auth, authorize('SELLER'), createProduct);
router.put('/seller/:id', auth, authorize('SELLER'), updateSellerProduct);
router.delete('/seller/:id', auth, authorize('SELLER'), deleteSellerProduct);
router.get('/:id', getProductById);
router.post('/:id/reviews', auth, authorize('CUSTOMER'), addReview);

module.exports = router;
