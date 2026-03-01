const express = require('express');
const offerController = require('../controllers/offerController');

const router = express.Router();

router.get('/', offerController.getOffersPage);
router.get('/help-content', offerController.getHelpContent);

module.exports = router;
