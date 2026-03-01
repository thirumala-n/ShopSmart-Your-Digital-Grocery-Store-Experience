const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { ROLES } = require('../utils/constants');
const wishlistController = require('../controllers/wishlistController');
const wishlistValidators = require('../validators/wishlistValidators');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.CUSTOMER));
router.get('/', wishlistController.listWishlist);
router.post('/items', validate(wishlistValidators.item), wishlistController.addWishlistItem);
router.delete('/items', validate(wishlistValidators.item), wishlistController.removeWishlistItem);
router.post('/notify-stock', validate(wishlistValidators.item), wishlistController.subscribeStockAlert);

module.exports = router;
