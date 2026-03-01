const { body, param, query } = require('express-validator');
const { ORDER_STATUS, PAYMENT_STATUS, ROLES } = require('../utils/constants');

const listOrders = [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(Object.values(ORDER_STATUS)),
  query('paymentStatus').optional().isIn(Object.values(PAYMENT_STATUS)),
  query('sellerId').optional().isMongoId(),
  query('orderId').optional().isString().trim().isLength({ min: 8, max: 64 }),
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601()
];

const listUsers = [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('role').optional().isIn([ROLES.ADMIN, ROLES.CUSTOMER, ROLES.SELLER]),
  query('status').optional().isIn(['ACTIVE', 'BLOCKED', 'PENDING_DELETION', 'DELETED']),
  query('search').optional().isString().trim().isLength({ min: 1, max: 120 })
];

const listAuditLogs = [query('page').optional().isInt({ min: 1 }), query('pageSize').optional().isInt({ min: 1, max: 100 })];

const blockUser = [
  param('id').isMongoId(),
  body('block').isBoolean(),
  body('reason').optional().isString().trim().isLength({ min: 2, max: 300 })
];

const updateUserRole = [
  param('id').isMongoId(),
  body('role').isIn([ROLES.ADMIN, ROLES.CUSTOMER, ROLES.SELLER])
];

const lowStockAlerts = [query('force').optional().isIn(['true', 'false'])];

const listStockMovements = [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('productId').optional().isMongoId(),
  query('variantId').optional().isMongoId(),
  query('reason').optional().isString().trim().isLength({ min: 2, max: 80 })
];

const reviewSellerProduct = [
  param('id').isMongoId(),
  body('action').isIn(['APPROVE', 'REJECT']),
  body('note').optional().isString().trim().isLength({ min: 2, max: 500 })
];

const reorderBanners = [body('bannerIds').isArray({ min: 1 }), body('bannerIds.*').isMongoId()];

const upsertHomeFeatured = [
  body('items').isArray(),
  body('items.*.section').isIn(['deals', 'trending']),
  body('items.*.productId').isMongoId(),
  body('items.*.imageUrl').optional().isString(),
  body('items.*.displayOrder').optional().isInt({ min: 0 }),
  body('items.*.isActive').optional().isBoolean()
];

const createCsvImportJob = [body('csvContent').isString().trim().isLength({ min: 10 })];

const csvImportJobParam = [param('jobId').isMongoId()];

const dashboardAnalytics = [
  query('rangeDays').optional().isIn(['7', '30', '90']),
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601()
];

const updateThreshold = [body('productId').isMongoId(), body('threshold').isInt({ min: 0, max: 100000 })];

module.exports = {
  listOrders,
  listUsers,
  listAuditLogs,
  blockUser,
  updateUserRole,
  lowStockAlerts,
  listStockMovements,
  reviewSellerProduct,
  reorderBanners,
  upsertHomeFeatured,
  createCsvImportJob,
  csvImportJobParam,
  dashboardAnalytics,
  updateThreshold
};
