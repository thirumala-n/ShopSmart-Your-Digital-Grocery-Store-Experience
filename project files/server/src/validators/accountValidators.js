const { body, param } = require('express-validator');

const updateProfile = [
  body('name').optional().isString().trim().isLength({ min: 2, max: 120 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().trim().isLength({ min: 10, max: 20 }),
  body('profileImage').optional().isString().trim()
];

const updateNotifications = [
  body('emailOrders').optional().isBoolean(),
  body('emailPromotions').optional().isBoolean(),
  body('smsOrders').optional().isBoolean(),
  body('pushNotifications').optional().isBoolean()
];

const updateAddresses = [
  body('addresses').isArray(),
  body('addresses.*.label').isString().trim().isLength({ min: 2, max: 20 }),
  body('addresses.*.fullName').isString().trim().isLength({ min: 2, max: 120 }),
  body('addresses.*.phone').isString().trim().isLength({ min: 10, max: 20 }),
  body('addresses.*.line1').isString().trim().isLength({ min: 5, max: 200 }),
  body('addresses.*.line2').optional().isString().trim().isLength({ max: 200 }),
  body('addresses.*.city').isString().trim().isLength({ min: 2, max: 120 }),
  body('addresses.*.state').isString().trim().isLength({ min: 2, max: 120 }),
  body('addresses.*.pincode').isString().trim().isLength({ min: 4, max: 12 }),
  body('addresses.*.isDefault').optional().isBoolean()
];

const changePassword = [
  body('currentPassword').isString().isLength({ min: 8, max: 64 }),
  body('newPassword')
    .isString()
    .isLength({ min: 8, max: 64 })
    .matches(/[A-Z]/)
    .matches(/[a-z]/)
    .matches(/[0-9]/)
    .matches(/[^A-Za-z0-9]/)
];

const recentlyViewed = [body('productId').isMongoId()];

const setTwoFactor = [body('enabled').isBoolean()];

const addSavedCard = [
  body('last4').isString().trim().isLength({ min: 4, max: 4 }),
  body('brand').isString().trim().isLength({ min: 2, max: 40 }),
  body('expiryMonth').isInt({ min: 1, max: 12 }),
  body('expiryYear').isInt({ min: 2024, max: 2100 }),
  body('gatewayToken').isString().trim().isLength({ min: 8, max: 300 }),
  body('isDefault').optional().isBoolean()
];

const cardIdParam = [param('cardId').isMongoId()];

const requestDataDownload = [];

const requestProfileOtp = [
  body('type').isIn(['email', 'phone']),
  body('value').isString().trim().isLength({ min: 5, max: 120 })
];

const verifyProfileOtp = [
  body('type').isIn(['email', 'phone']),
  body('value').isString().trim().isLength({ min: 5, max: 120 }),
  body('otp').isString().trim().isLength({ min: 4, max: 8 })
];

module.exports = {
  updateProfile,
  updateNotifications,
  updateAddresses,
  setTwoFactor,
  addSavedCard,
  cardIdParam,
  requestDataDownload,
  requestProfileOtp,
  verifyProfileOtp,
  changePassword,
  recentlyViewed
};
