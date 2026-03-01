const { param, query } = require('express-validator');
const { ORDER_STATUS } = require('../utils/constants');

const listOrders = [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(Object.values(ORDER_STATUS))
];

const listProducts = [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 })
];

const orderIdParam = [param('orderId').isString().trim().isLength({ min: 10, max: 64 })];

const stockMovements = [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 })
];

const analyticsQuery = [
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601()
];

module.exports = {
  listOrders,
  listProducts,
  orderIdParam,
  stockMovements,
  analyticsQuery
};
