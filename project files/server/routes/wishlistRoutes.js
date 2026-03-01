const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  getWishlist,
  getWishlistIds,
  toggleWishlist,
  removeFromWishlist
} = require('../controllers/wishlistController');

const router = express.Router();

router.use(auth, authorize('CUSTOMER'));
router.get('/', getWishlist);
router.get('/ids', getWishlistIds);
router.post('/toggle', toggleWishlist);
router.delete('/:productId', removeFromWishlist);

module.exports = router;
