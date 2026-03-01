const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const reportController = require('../controllers/reportController');
const validate = require('../middleware/validate');
const reportValidators = require('../validators/reportValidators');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.ADMIN));
router.get('/sales', validate(reportValidators.dateRange), reportController.salesReport);
router.get('/revenue', validate(reportValidators.dateRange), reportController.revenueReport);
router.get('/product-performance', reportController.productPerformanceReport);
router.get('/customer-growth', validate(reportValidators.dateRange), reportController.customerGrowthReport);
router.get('/sales/export', validate(reportValidators.dateRange), reportController.exportSalesCsv);
router.get('/sales/export-pdf', validate(reportValidators.dateRange), reportController.exportSalesPdf);
router.get('/revenue/export', validate(reportValidators.dateRange), reportController.exportRevenueCsv);
router.get('/customer-growth/export', validate(reportValidators.dateRange), reportController.exportCustomerGrowthCsv);
router.get('/product-performance/export', reportController.exportProductPerformanceCsv);

module.exports = router;
