const express = require('express');
const {
  initiatePayment,
  confirmPayment,
  getPaymentStatus
} = require('../controllers/paymentController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/initiate', auth, initiatePayment);
router.post('/confirm', auth, confirmPayment);
router.get('/:orderId', auth, getPaymentStatus);

module.exports = router;
