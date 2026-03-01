const Order = require('../models/Order');

const findById = (id, projection = null, session = null) =>
  Order.findById(id, projection || undefined, { session });

const findByOrderId = (orderId, projection = null) =>
  Order.findOne({ orderId }, projection || undefined).lean();

const countByUserId = (userId) => Order.countDocuments({ userId });

const createOrder = async (payload, session = null) => {
  const options = session ? { session } : {};
  const [created] = await Order.create([payload], options);
  return created;
};

const listByGroupId = (orderGroupId, projection = null, session = null) =>
  Order.find({ orderGroupId }, projection || undefined, { session }).sort({ createdAt: 1 }).lean();

const listPendingPaymentOrdersBefore = ({ cutoff, limit = 200 }) =>
  Order.find({
    orderStatus: 'PENDING_PAYMENT',
    createdAt: { $lte: cutoff }
  })
    .select('orderId userId')
    .limit(limit)
    .lean();

const listUserOrders = async ({ userId, activeOnly, page, pageSize, skip }) => {
  const query = { userId };
  if (activeOnly) {
    query.orderStatus = { $nin: ['DELIVERED', 'CANCELLED', 'REFUNDED'] };
  } else {
    query.orderStatus = { $in: ['DELIVERED', 'CANCELLED', 'REFUNDED'] };
  }
  const [items, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .select('-deliveryOTP')
      .lean(),
    Order.countDocuments(query)
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
};

const listOrders = async ({ query, page, pageSize, skip, sort = { createdAt: -1 } }) => {
  const [items, total] = await Promise.all([
    Order.find(query).sort(sort).skip(skip).limit(pageSize).select('-deliveryOTP').lean(),
    Order.countDocuments(query)
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
};

const listOrdersBySeller = async ({ sellerId, status, page, pageSize, skip, fromDate = null, toDate = null }) => {
  const query = { sellerId };
  if (status) query.orderStatus = status;
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = fromDate;
    if (toDate) query.createdAt.$lte = toDate;
  }
  return listOrders({ query, page, pageSize, skip });
};

const findByOrderIdAndSeller = (orderId, sellerId, projection = null) =>
  Order.findOne({ orderId, sellerId }, projection || undefined).lean();

const listByCreatedAtRange = ({ fromDate, toDate, projection = 'totalAmount' }) => {
  const query = { createdAt: {} };
  if (fromDate) query.createdAt.$gte = fromDate;
  if (toDate) query.createdAt.$lt = toDate;
  return Order.find(query).select(projection).lean();
};

const getOrdersRevenueSummary = async ({ fromDate = null, toDate = null, match = {} }) => {
  const query = { ...match };
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = fromDate;
    if (toDate) query.createdAt.$lt = toDate;
  }
  const [summary] = await Order.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        revenue: { $sum: '$totalAmount' }
      }
    }
  ]);
  return {
    orders: Number(summary?.orders || 0),
    revenue: Number((summary?.revenue || 0).toFixed(2))
  };
};

const save = (order, session = null) => order.save({ session });

const getRevenueSeriesByDay = async ({ days = 30 }) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return Order.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};

const getRevenueSeriesByRange = async ({ fromDate = null, toDate = null }) => {
  const match = {};
  if (fromDate || toDate) {
    match.createdAt = {};
    if (fromDate) match.createdAt.$gte = fromDate;
    if (toDate) match.createdAt.$lte = toDate;
  }
  return Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};

const getOrdersByStatus = (match = {}) =>
  Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$orderStatus',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

const getTopSellingProductsFromOrders = (limit = 10, match = {}) =>
  Order.aggregate([
    { $match: match },
    { $unwind: '$orderItems' },
    {
      $group: {
        _id: '$orderItems.productId',
        productName: { $first: '$orderItems.productName' },
        totalUnitsSold: { $sum: '$orderItems.quantity' },
        totalRevenue: { $sum: '$orderItems.lineTotal' }
      }
    },
    { $sort: { totalUnitsSold: -1 } },
    { $limit: limit }
  ]);

const listRecentOrders = (limit = 10, match = {}) =>
  Order.find(match)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('orderId userId totalAmount orderStatus createdAt')
    .lean();

const getRevenueSeriesByDayForSeller = async ({ sellerId, days = 30 }) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return Order.aggregate([
    { $match: { sellerId, createdAt: { $gte: start } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};

const getRevenueSeriesByDateRangeForSeller = async ({ sellerId, fromDate = null, toDate = null, days = 30 }) => {
  const match = { sellerId };
  if (fromDate || toDate) {
    match.createdAt = {};
    if (fromDate) match.createdAt.$gte = fromDate;
    if (toDate) match.createdAt.$lte = toDate;
  } else {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    match.createdAt = { $gte: start };
  }

  return Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};

const getTopSellingProductsBySeller = (sellerIdOrOptions, limit = 10) => {
  const sellerId = typeof sellerIdOrOptions === 'object' && sellerIdOrOptions !== null ? sellerIdOrOptions.sellerId : sellerIdOrOptions;
  const resolvedLimit =
    typeof sellerIdOrOptions === 'object' && sellerIdOrOptions !== null && sellerIdOrOptions.limit
      ? sellerIdOrOptions.limit
      : limit;

  return Order.aggregate([
    { $match: { sellerId } },
    { $unwind: '$orderItems' },
    {
      $group: {
        _id: '$orderItems.productId',
        productName: { $first: '$orderItems.productName' },
        totalUnitsSold: { $sum: '$orderItems.quantity' },
        totalRevenue: { $sum: '$orderItems.lineTotal' }
      }
    },
    { $sort: { totalUnitsSold: -1 } },
    { $limit: resolvedLimit }
  ]);
};

const getTopSellingProductsBySellerInRange = ({ sellerId, limit = 10, fromDate = null, toDate = null }) => {
  const match = { sellerId };
  if (fromDate || toDate) {
    match.createdAt = {};
    if (fromDate) match.createdAt.$gte = fromDate;
    if (toDate) match.createdAt.$lte = toDate;
  }
  return Order.aggregate([
    { $match: match },
    { $unwind: '$orderItems' },
    {
      $group: {
        _id: '$orderItems.productId',
        productName: { $first: '$orderItems.productName' },
        totalUnitsSold: { $sum: '$orderItems.quantity' },
        totalRevenue: { $sum: '$orderItems.lineTotal' }
      }
    },
    { $sort: { totalUnitsSold: -1 } },
    { $limit: limit }
  ]);
};

const listRecentOrdersBySeller = (sellerIdOrOptions, limit = 10) => {
  const sellerId = typeof sellerIdOrOptions === 'object' && sellerIdOrOptions !== null ? sellerIdOrOptions.sellerId : sellerIdOrOptions;
  const resolvedLimit =
    typeof sellerIdOrOptions === 'object' && sellerIdOrOptions !== null && sellerIdOrOptions.limit
      ? sellerIdOrOptions.limit
      : limit;

  return Order.find({ sellerId })
    .sort({ createdAt: -1 })
    .limit(resolvedLimit)
    .select('orderId userId totalAmount orderStatus createdAt deliverySlot shippingAddress orderItems')
    .lean();
};

const getSellerSummaryStats = async ({ sellerId, fromDate = null, toDate = null }) => {
  const match = { sellerId };
  if (fromDate || toDate) {
    match.createdAt = {};
    if (fromDate) match.createdAt.$gte = fromDate;
    if (toDate) match.createdAt.$lte = toDate;
  }

  const [aggregate] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalOrders: { $sum: 1 },
        deliveredCount: {
          $sum: { $cond: [{ $eq: ['$orderStatus', 'DELIVERED'] }, 1, 0] }
        },
        shippedCount: {
          $sum: {
            $cond: [{ $in: ['$orderStatus', ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']] }, 1, 0]
          }
        }
      }
    }
  ]);

  return {
    totalRevenue: Number((aggregate?.totalRevenue || 0).toFixed(2)),
    totalOrders: Number(aggregate?.totalOrders || 0),
    deliveredCount: Number(aggregate?.deliveredCount || 0),
    shippedCount: Number(aggregate?.shippedCount || 0)
  };
};

const countBySellerAndStatuses = ({ sellerId, statuses = [] }) =>
  Order.countDocuments({ sellerId, orderStatus: { $in: statuses } });

module.exports = {
  findById,
  findByOrderId,
  countByUserId,
  createOrder,
  listByGroupId,
  listPendingPaymentOrdersBefore,
  listUserOrders,
  listOrders,
  listOrdersBySeller,
  findByOrderIdAndSeller,
  listByCreatedAtRange,
  getOrdersRevenueSummary,
  save,
  getRevenueSeriesByDay,
  getRevenueSeriesByRange,
  getOrdersByStatus,
  getTopSellingProductsFromOrders,
  listRecentOrders,
  getRevenueSeriesByDayForSeller,
  getRevenueSeriesByDateRangeForSeller,
  getTopSellingProductsBySeller,
  getTopSellingProductsBySellerInRange,
  listRecentOrdersBySeller,
  getSellerSummaryStats,
  countBySellerAndStatuses
};
