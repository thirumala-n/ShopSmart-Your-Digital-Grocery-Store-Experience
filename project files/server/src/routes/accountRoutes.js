const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { ROLES } = require('../utils/constants');
const accountController = require('../controllers/accountController');
const accountValidators = require('../validators/accountValidators');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.CUSTOMER, ROLES.ADMIN, ROLES.SELLER));
router.get('/me', accountController.getProfile);
router.patch('/me', validate(accountValidators.updateProfile), accountController.updateProfile);
router.patch('/me/notifications', validate(accountValidators.updateNotifications), accountController.updateNotifications);
router.put('/me/addresses', validate(accountValidators.updateAddresses), accountController.updateAddresses);
router.get('/me/sessions', accountController.listSessions);
router.patch('/me/two-factor', validate(accountValidators.setTwoFactor), accountController.setTwoFactor);
router.get('/me/cards', accountController.listSavedCards);
router.post('/me/cards', validate(accountValidators.addSavedCard), accountController.addSavedCard);
router.delete('/me/cards/:cardId', validate(accountValidators.cardIdParam), accountController.removeSavedCard);
router.patch('/me/cards/:cardId/default', validate(accountValidators.cardIdParam), accountController.setDefaultCard);
router.post('/me/change-password', validate(accountValidators.changePassword), accountController.changePassword);
router.post('/me/logout-all', accountController.logoutAllDevices);
router.post('/me/data-download', validate(accountValidators.requestDataDownload), accountController.requestDataDownload);
router.post('/me/profile-otp/request', validate(accountValidators.requestProfileOtp), accountController.requestProfileOtp);
router.post('/me/profile-otp/verify', validate(accountValidators.verifyProfileOtp), accountController.verifyProfileOtp);
router.post('/me/delete-request', accountController.requestDeletion);
router.post('/me/recently-viewed', validate(accountValidators.recentlyViewed), accountController.addRecentlyViewed);
router.get('/me/recently-viewed', accountController.listRecentlyViewed);

module.exports = router;
