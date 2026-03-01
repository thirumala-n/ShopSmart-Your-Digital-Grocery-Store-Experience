const { query } = require('express-validator');

const dateRange = [
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601()
];

module.exports = {
  dateRange
};
