const reportRepository = require('../repositories/reportRepository');

const getSalesReport = (payload) => reportRepository.salesSummary(payload);
const getRevenueReport = (payload) => reportRepository.revenueSummary(payload);
const getProductPerformanceReport = () => reportRepository.productPerformance();
const getCustomerGrowthReport = (payload) => reportRepository.customerGrowth(payload);

module.exports = {
  getSalesReport,
  getRevenueReport,
  getProductPerformanceReport,
  getCustomerGrowthReport
};
