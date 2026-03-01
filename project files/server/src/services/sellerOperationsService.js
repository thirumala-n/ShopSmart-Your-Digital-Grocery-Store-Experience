const AppError = require('../utils/AppError');
const orderRepository = require('../repositories/orderRepository');
const sellerCatalogRepository = require('../repositories/sellerCatalogRepository');
const stockMovementRepository = require('../repositories/stockMovementRepository');
const { toCsv } = require('../utils/csv');

const parseDateRange = ({ fromDate, toDate }) => {
  let parsedFrom = null;
  let parsedTo = null;
  if (fromDate) {
    parsedFrom = new Date(fromDate);
    if (Number.isNaN(parsedFrom.getTime())) {
      throw new AppError('Invalid fromDate', 400, 'INVALID_FROM_DATE');
    }
    if (typeof fromDate === 'string' && fromDate.length === 10) {
      parsedFrom.setHours(0, 0, 0, 0);
    }
  }
  if (toDate) {
    parsedTo = new Date(toDate);
    if (Number.isNaN(parsedTo.getTime())) {
      throw new AppError('Invalid toDate', 400, 'INVALID_TO_DATE');
    }
    if (typeof toDate === 'string' && toDate.length === 10) {
      parsedTo.setHours(23, 59, 59, 999);
    }
  }
  if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
    throw new AppError('fromDate must be before or equal to toDate', 400, 'INVALID_DATE_RANGE');
  }
  return { fromDate: parsedFrom, toDate: parsedTo };
};

const listSellerOrders = async ({ sellerId, status, page, pageSize, skip }) => {
  return orderRepository.listOrdersBySeller({ sellerId, status, page, pageSize, skip });
};

const getSellerOrderByOrderId = async ({ sellerId, orderId }) => {
  const order = await orderRepository.findByOrderIdAndSeller(orderId, sellerId);
  if (!order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }
  return order;
};

const getSellerDashboard = async ({ sellerId }) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const [todayOrders, allOrders, lowStock, revenueSeries, topProducts, recentOrders] = await Promise.all([
    orderRepository.getSellerSummaryStats({ sellerId, fromDate: todayStart }),
    orderRepository.countBySellerAndStatuses({ sellerId, statuses: ['CONFIRMED', 'PROCESSING', 'PACKED'] }),
    sellerCatalogRepository.listSellerLowStockVariants({ sellerId }),
    orderRepository.getRevenueSeriesByDayForSeller({ sellerId, days: 30 }),
    orderRepository.getTopSellingProductsBySeller({ sellerId, limit: 5 }),
    orderRepository.listRecentOrdersBySeller({ sellerId, limit: 10 })
  ]);

  const todayRevenue = todayOrders.totalRevenue;
  const pendingOrders = allOrders;

  const yesterdayStats = await orderRepository.getSellerSummaryStats({
    sellerId,
    fromDate: yesterdayStart,
    toDate: todayStart
  });
  const yesterdayRevenue = yesterdayStats.totalRevenue;
  const revenueDeltaPct = yesterdayRevenue ? Number((((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(2)) : 100;

  return {
    metrics: {
      todayRevenue,
      todayOrders: todayOrders.totalOrders || 0,
      lowStockCount: lowStock.length,
      pendingOrders,
      revenueDeltaPct
    },
    revenueSeries,
    topProducts,
    recentOrders
  };
};

const getSellerAnalytics = async ({ sellerId, fromDate = null, toDate = null }) => {
  const range = parseDateRange({ fromDate, toDate });

  const [summary, revenueSeries, topProducts] = await Promise.all([
    orderRepository.getSellerSummaryStats({
      sellerId,
      fromDate: range.fromDate,
      toDate: range.toDate
    }),
    orderRepository.getRevenueSeriesByDateRangeForSeller({
      sellerId,
      fromDate: range.fromDate,
      toDate: range.toDate,
      days: 30
    }),
    orderRepository.getTopSellingProductsBySellerInRange({
      sellerId,
      limit: 20,
      fromDate: range.fromDate,
      toDate: range.toDate
    })
  ]);

  const delivered = summary.deliveredCount;
  const shipped = summary.shippedCount;
  const fulfillmentRate = shipped ? Number(((delivered / shipped) * 100).toFixed(2)) : 0;

  return {
    revenueSeries,
    topProducts,
    fulfillmentRate,
    totalOrders: summary.totalOrders || 0,
    totalRevenue: summary.totalRevenue || 0
  };
};

const exportSellerSalesCsv = async ({ sellerId, fromDate = null, toDate = null }) => {
  const data = await getSellerAnalytics({ sellerId, fromDate, toDate });
  const rows = (data.revenueSeries || []).map((item) => ({
    date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
    revenue: item.revenue,
    orders: item.orders
  }));
  return toCsv(['date', 'revenue', 'orders'], rows);
};

const listSellerStockMovements = async ({ sellerId, page, pageSize, skip }) => {
  return stockMovementRepository.listMovementsBySeller({ sellerId, page, pageSize, skip });
};

module.exports = {
  listSellerOrders,
  getSellerOrderByOrderId,
  getSellerDashboard,
  getSellerAnalytics,
  exportSellerSalesCsv,
  listSellerStockMovements
};
