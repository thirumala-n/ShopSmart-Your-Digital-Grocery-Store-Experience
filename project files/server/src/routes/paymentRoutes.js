const express = require('express');
const paymentController = require('../controllers/paymentController');
const validate = require('../middleware/validate');
const paymentValidators = require('../validators/paymentValidators');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.post('/webhook', express.raw({ type: 'application/json', limit: '1mb' }), paymentController.webhook);
router.post(
  '/create-order',
  authenticate,
  authorizeRoles(ROLES.CUSTOMER),
  validate(paymentValidators.createGatewayOrder),
  paymentController.createGatewayOrder
);
router.post(
  '/refund',
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  validate(paymentValidators.initiateRefund),
  paymentController.initiateRefund
);

module.exports = router;
