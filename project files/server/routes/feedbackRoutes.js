const express = require('express');
const { submitFeedback, getAllFeedback } = require('../controllers/feedbackController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.post('/', auth, authorize('CUSTOMER'), submitFeedback);
router.get('/', auth, authorize('ADMIN'), getAllFeedback);

module.exports = router;
