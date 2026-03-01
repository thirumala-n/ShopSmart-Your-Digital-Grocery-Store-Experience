const express = require('express');
const {
  register,
  login,
  sendOTP,
  verifyOTP,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const authRateLimit = require('../middleware/authRateLimit');

const router = express.Router();

router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);
router.post('/send-otp', authRateLimit, sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/forgot-password', authRateLimit, forgotPassword);
router.post('/reset-password', authRateLimit, resetPassword);

module.exports = router;
