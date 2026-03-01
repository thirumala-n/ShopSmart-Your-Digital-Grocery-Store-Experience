const express = require('express');
const { getProfile } = require('../controllers/userController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/me', auth, getProfile);

module.exports = router;
