const express = require('express');
const orderController = require('../controllers/orderController');
const validate = require('../middleware/validate');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const orderValidators = require('../validators/orderValidators');

const router = express.Router();

router.use(authenticate);
router.get('/my', authorizeRoles(ROLES.CUSTOMER), orderController.listMyOrders);
router.get('/my-groups', authorizeRoles(ROLES.CUSTOMER), orderController.listMyOrderGroups);
router.get('/groups/:orderGroupId', validate(orderValidators.orderGroupParam), orderController.getByOrderGroupId);
router.post(
  '/groups/:orderGroupId/cancel',
  authorizeRoles(ROLES.CUSTOMER, ROLES.ADMIN),
  validate(orderValidators.orderGroupParam),
  orderController.cancelOrderGroup
);
router.post(
  '/groups/:orderGroupId/refund/initiate',
  authorizeRoles(ROLES.ADMIN),
  validate(orderValidators.orderGroupParam),
  orderController.initiateGroupRefund
);
router.post(
  '/groups/:orderGroupId/refund/settle',
  authorizeRoles(ROLES.ADMIN),
  validate(orderValidators.settleGroupRefund),
  orderController.settleGroupRefund
);
router.get('/:orderId', validate(orderValidators.orderIdParam), orderController.getByOrderId);
router.post('/', authorizeRoles(ROLES.CUSTOMER), validate(orderValidators.placeOrder), orderController.placeOrder);
router.post(
  '/:orderId/confirm-payment',
  authorizeRoles(ROLES.CUSTOMER, ROLES.ADMIN),
  validate(orderValidators.confirmPayment),
  orderController.confirmPayment
);
router.patch(
  '/:orderId/status',
  authorizeRoles(ROLES.CUSTOMER, ROLES.ADMIN, ROLES.SELLER),
  validate(orderValidators.updateStatus),
  orderController.updateStatus
);

module.exports = router;
