const asyncHandler = require('../utils/asyncHandler');
const reportService = require('../services/reportService');
const { toCsv } = require('../utils/csv');
const PDFDocument = require('pdfkit');

const salesReport = asyncHandler(async (req, res) => {
  const data = await reportService.getSalesReport({
    fromDate: req.query.fromDate,
    toDate: req.query.toDate
  });
  res.status(200).json({ success: true, data });
});

const productPerformanceReport = asyncHandler(async (req, res) => {
  const data = await reportService.getProductPerformanceReport();
  res.status(200).json({
    success: true,
    data,
    items: data,
    total: data.length,
    page: 1,
    pageSize: data.length,
    totalPages: 1
  });
});

const revenueReport = asyncHandler(async (req, res) => {
  const data = await reportService.getRevenueReport({
    fromDate: req.query.fromDate,
    toDate: req.query.toDate
  });
  res.status(200).json({ success: true, data });
});

const customerGrowthReport = asyncHandler(async (req, res) => {
  const data = await reportService.getCustomerGrowthReport({
    fromDate: req.query.fromDate,
    toDate: req.query.toDate
  });
  res.status(200).json({ success: true, data });
});

const exportSalesCsv = asyncHandler(async (req, res) => {
  const data = await reportService.getSalesReport({
    fromDate: req.query.fromDate,
    toDate: req.query.toDate
  });
  const headers = ['totalOrders', 'totalRevenue', 'totalUnits', 'averageOrderValue'];
  const csv = toCsv(headers, [data]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sales_report.csv"');
  res.status(200).send(csv);
});

const exportSalesPdf = asyncHandler(async (req, res) => {
  const data = await reportService.getSalesReport({
    fromDate: req.query.fromDate,
    toDate: req.query.toDate
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);
  doc.fontSize(18).text('Sales Report', { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Total Orders: ${data.totalOrders || 0}`);
  doc.text(`Total Revenue: INR ${data.totalRevenue || 0}`);
  doc.text(`Total Units: ${data.totalUnits || 0}`);
  doc.text(`Average Order Value: INR ${data.averageOrderValue || 0}`);
  doc.moveDown();
  doc.text('By Seller:', { underline: true });
  (data.bySeller || []).forEach((row) => {
    doc.text(`Seller: ${row._id} | Orders: ${row.totalOrders} | Revenue: INR ${row.totalRevenue}`);
  });
  doc.end();
});

const exportRevenueCsv = asyncHandler(async (req, res) => {
  const data = await reportService.getRevenueReport({
    fromDate: req.query.fromDate,
    toDate: req.query.toDate
  });
  const rows = (data.dailyRevenueSeries || []).map((item) => ({
    date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
    revenue: item.revenue
  }));
  const csv = toCsv(['date', 'revenue'], rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="revenue_report.csv"');
  res.status(200).send(csv);
});

const exportCustomerGrowthCsv = asyncHandler(async (req, res) => {
  const data = await reportService.getCustomerGrowthReport({
    fromDate: req.query.fromDate,
    toDate: req.query.toDate
  });
  const rows = (data.registrations || []).map((item) => ({
    date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
    count: item.count
  }));
  const csv = toCsv(['date', 'count'], rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="customer_growth_report.csv"');
  res.status(200).send(csv);
});

const exportProductPerformanceCsv = asyncHandler(async (_req, res) => {
  const data = await reportService.getProductPerformanceReport();
  const csv = toCsv(['name', 'sku', 'totalUnitsSold', 'totalRevenue', 'averageRating', 'returnRate'], data);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="product_performance_report.csv"');
  res.status(200).send(csv);
});

module.exports = {
  salesReport,
  revenueReport,
  productPerformanceReport,
  customerGrowthReport,
  exportSalesCsv,
  exportSalesPdf,
  exportRevenueCsv,
  exportCustomerGrowthCsv,
  exportProductPerformanceCsv
};
