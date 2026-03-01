const express = require('express');
const cartController = require('../controllers/cartController');
const validate = require('../middleware/validate');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const cartValidators = require('../validators/cartValidators');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.CUSTOMER));
router.get('/', cartController.getCart);
router.post('/items', validate(cartValidators.itemFields), cartController.addItem);
router.patch('/items', validate(cartValidators.itemFields), cartController.updateItem);
router.delete('/items', validate(cartValidators.removeItem), cartController.removeItem);
router.post('/coupon', validate(cartValidators.applyCoupon), cartController.applyCoupon);
router.delete('/coupon', cartController.clearCoupon);

module.exports = router;
