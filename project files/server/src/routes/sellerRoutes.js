const express = require('express');
const sellerController = require('../controllers/sellerController');
const sellerCatalogController = require('../controllers/sellerCatalogController');
const validate = require('../middleware/validate');
const sellerCatalogValidators = require('../validators/sellerCatalogValidators');
const sellerValidators = require('../validators/sellerValidators');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.SELLER));
router.get('/dashboard', sellerController.dashboard);
router.get('/analytics', validate(sellerValidators.analyticsQuery), sellerController.analytics);
router.get('/analytics/export', validate(sellerValidators.analyticsQuery), sellerController.analyticsExport);
router.get('/orders', validate(sellerValidators.listOrders), sellerController.listSellerOrders);
router.get('/orders/:orderId', validate(sellerValidators.orderIdParam), sellerController.getSellerOrder);
router.get('/products', validate(sellerValidators.listProducts), sellerCatalogController.listProducts);
router.post('/products/upsert', validate(sellerCatalogValidators.upsertProduct), sellerCatalogController.upsertProduct);
router.patch('/inventory/stock', validate(sellerCatalogValidators.updateStock), sellerCatalogController.updateStock);
router.get('/inventory/movements', validate(sellerValidators.stockMovements), sellerController.stockMovements);

module.exports = router;
