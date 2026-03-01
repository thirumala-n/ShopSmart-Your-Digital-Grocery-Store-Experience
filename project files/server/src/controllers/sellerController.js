const asyncHandler = require('../utils/asyncHandler');
const { getPagination } = require('../utils/pagination');
const sellerOperationsService = require('../services/sellerOperationsService');

const listSellerOrders = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const data = await sellerOperationsService.listSellerOrders({
    sellerId: req.auth.userId,
    status: req.query.status,
    page,
    pageSize,
    skip
  });
  res.status(200).json({ success: true, ...data });
});

const getSellerOrder = asyncHandler(async (req, res) => {
  const data = await sellerOperationsService.getSellerOrderByOrderId({
    sellerId: req.auth.userId,
    orderId: req.params.orderId
  });
  res.status(200).json({ success: true, data });
});

const dashboard = asyncHandler(async (req, res) => {
  const data = await sellerOperationsService.getSellerDashboard({ sellerId: req.auth.userId });
  res.status(200).json({ success: true, data });
});

const analytics = asyncHandler(async (req, res) => {
  const data = await sellerOperationsService.getSellerAnalytics({
    sellerId: req.auth.userId,
    fromDate: req.query.fromDate,
    toDate: req.query.toDate
  });
  res.status(200).json({ success: true, data });
});

const analyticsExport = asyncHandler(async (req, res) => {
  const csv = await sellerOperationsService.exportSellerSalesCsv({
    sellerId: req.auth.userId,
    fromDate: req.query.fromDate,
    toDate: req.query.toDate
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="seller_sales_report.csv"');
  res.status(200).send(csv);
});

const stockMovements = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const data = await sellerOperationsService.listSellerStockMovements({
    sellerId: req.auth.userId,
    page,
    pageSize,
    skip
  });
  res.status(200).json({ success: true, ...data });
});

module.exports = {
  listSellerOrders,
  getSellerOrder,
  dashboard,
  analytics,
  analyticsExport,
  stockMovements
};
