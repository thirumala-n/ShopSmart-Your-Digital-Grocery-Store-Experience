const express = require('express');
const publicController = require('../controllers/publicController');
const validate = require('../middleware/validate');
const publicValidators = require('../validators/publicValidators');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/delivery-slots', publicController.listDeliverySlots);
router.get('/home-featured', publicController.getHomeFeaturedConfig);
router.get(
  '/delivery-availability/:pincode',
  validate(publicValidators.deliveryAvailability),
  publicController.checkDeliveryAvailability
);
router.post('/newsletter', validate(publicValidators.newsletter), publicController.subscribeNewsletter);
router.post('/support', validate(publicValidators.supportTicket), publicController.createSupportTicket);
router.post('/support/authenticated', authenticate, validate(publicValidators.supportTicket), publicController.createSupportTicket);

module.exports = router;
