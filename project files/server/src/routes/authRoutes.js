const express = require('express');
const validate = require('../middleware/validate');
const authController = require('../controllers/authController');
const authValidators = require('../validators/authValidators');
const { authenticate } = require('../middleware/auth');
const { loginRateLimit } = require('../middleware/security');

const router = express.Router();

router.post('/register', validate(authValidators.register), authController.register);
router.post('/login', loginRateLimit, validate(authValidators.login), authController.login);
router.post('/refresh', validate(authValidators.refresh), authController.refresh);
router.post('/logout', authenticate, validate(authValidators.logout), authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);

module.exports = router;
