const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

const getDateRangeMatch = (fromDate, toDate) => {
  const match = {};
  if (fromDate || toDate) {
    match.createdAt = {};
    if (fromDate) match.createdAt.$gte = new Date(fromDate);
    if (toDate) match.createdAt.$lte = new Date(toDate);
  }
  return match;
};

const salesSummary = async ({ fromDate, toDate }) => {
  const match = getDateRangeMatch(fromDate, toDate);
  const [totals] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        totalUnits: { $sum: { $sum: '$orderItems.quantity' } }
      }
    }
  ]);

  const bySeller = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$sellerId',
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  return {
    totalOrders: totals?.totalOrders || 0,
    totalRevenue: totals?.totalRevenue || 0,
    totalUnits: totals?.totalUnits || 0,
    averageOrderValue: totals?.totalOrders ? Number((totals.totalRevenue / totals.totalOrders).toFixed(2)) : 0,
    bySeller
  };
};

const productPerformance = async () => {
  const rows = await Product.find(
    {},
    {
      name: 1,
      SKU: 1,
      salesCount: 1,
      rating: 1,
      totalReviews: 1
    }
  )
    .sort({ salesCount: -1 })
    .limit(1000)
    .lean();

  return rows.map((row) => ({
    productId: row._id,
    name: row.name,
    sku: row.SKU,
    totalUnitsSold: row.salesCount,
    totalRevenue: 0,
    averageRating: row.rating,
    returnRate: 0
  }));
};

const customerGrowth = async ({ fromDate, toDate }) => {
  const match = getDateRangeMatch(fromDate, toDate);
  const registrations = await User.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  const repeatPurchasers = await Order.aggregate([
    {
      $group: {
        _id: '$userId',
        ordersCount: { $sum: 1 },
        totalSpend: { $sum: '$totalAmount' }
      }
    }
  ]);
  const repeatCount = repeatPurchasers.filter((entry) => entry.ordersCount > 1).length;
  const topCustomers = repeatPurchasers.sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10);

  return {
    registrations,
    totalActiveUsers: repeatPurchasers.length,
    repeatPurchaseRate: repeatPurchasers.length ? Number(((repeatCount / repeatPurchasers.length) * 100).toFixed(2)) : 0,
    averageOrdersPerUser: repeatPurchasers.length
      ? Number((repeatPurchasers.reduce((sum, entry) => sum + entry.ordersCount, 0) / repeatPurchasers.length).toFixed(2))
      : 0,
    topCustomers
  };
};

const revenueSummary = async ({ fromDate, toDate }) => {
  const match = getDateRangeMatch(fromDate, toDate);
  const daily = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        revenue: { $sum: '$totalAmount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  let cumulative = 0;
  const cumulativeSeries = daily.map((item) => {
    cumulative += item.revenue || 0;
    return { ...item, cumulativeRevenue: Number(cumulative.toFixed(2)) };
  });

  const byPaymentMethod = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$paymentMethod',
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { revenue: -1 } }
  ]);

  const refunds = await Order.aggregate([
    { $match: { ...match, paymentStatus: 'REFUNDED' } },
    {
      $group: {
        _id: null,
        refundAmount: { $sum: '$totalAmount' }
      }
    }
  ]);

  return {
    dailyRevenueSeries: daily,
    cumulativeRevenueSeries: cumulativeSeries,
    revenueByPaymentMethod: byPaymentMethod,
    refundAmount: refunds[0]?.refundAmount || 0
  };
};

module.exports = {
  salesSummary,
  productPerformance,
  customerGrowth,
  revenueSummary
};
