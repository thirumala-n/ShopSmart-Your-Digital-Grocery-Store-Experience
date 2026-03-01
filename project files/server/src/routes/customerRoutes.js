const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.CUSTOMER));

router.get('/home', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      role: req.auth.role,
      userId: req.auth.userId
    }
  });
});

module.exports = router;

