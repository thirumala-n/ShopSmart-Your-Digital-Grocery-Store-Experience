const express = require('express');
const {
  placeOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  getOrderTracking,
  getOrderAnalytics,
  streamOrderStatus,
  downloadInvoice,
  getSellerOrders,
  updateSellerOrderStatus
} = require('../controllers/orderController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.post('/', auth, authorize('CUSTOMER'), placeOrder);
router.get('/my', auth, authorize('CUSTOMER'), getUserOrders);
router.get('/stream', auth, authorize('CUSTOMER'), streamOrderStatus);
router.get('/analytics', auth, authorize('ADMIN'), getOrderAnalytics);
router.get('/', auth, authorize('ADMIN'), getAllOrders);
router.get('/seller/my-orders', auth, authorize('SELLER'), getSellerOrders);
router.get('/:id/tracking', auth, getOrderTracking);
router.get('/:id/invoice', auth, downloadInvoice);
router.put('/:id/status', auth, authorize('ADMIN'), updateOrderStatus);
router.put('/seller/:id/status', auth, authorize('SELLER'), updateSellerOrderStatus);
router.put('/:id/cancel', auth, cancelOrder);

module.exports = router;
