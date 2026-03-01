const asyncHandler = require('../utils/asyncHandler');
const { getPagination } = require('../utils/pagination');
const orderRepository = require('../repositories/orderRepository');
const userRepository = require('../repositories/userRepository');
const inventoryService = require('../services/inventoryService');
const cacheService = require('../services/cacheService');
const stockMovementRepository = require('../repositories/stockMovementRepository');
const catalogAdminRepository = require('../repositories/catalogAdminRepository');
const bannerRepository = require('../repositories/bannerRepository');
const adminImportService = require('../services/adminImportService');
const AppError = require('../utils/AppError');
const { toCsv } = require('../utils/csv');
const catalogAdminService = require('../services/catalogAdminService');
const auditLogService = require('../services/auditLogService');
const homeFeaturedRepository = require('../repositories/homeFeaturedRepository');

const listOrders = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const query = {};
  if (req.query.status) query.orderStatus = req.query.status;
  if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;
  if (req.query.sellerId) query.sellerId = req.query.sellerId;
  if (req.query.orderId) query.orderId = req.query.orderId;
  if (req.query.fromDate || req.query.toDate) {
    query.createdAt = {};
    if (req.query.fromDate) query.createdAt.$gte = new Date(req.query.fromDate);
    if (req.query.toDate) query.createdAt.$lte = new Date(req.query.toDate);
  }
  const data = await orderRepository.listOrders({ query, page, pageSize, skip });
  res.status(200).json({ success: true, ...data });
});

const lowStockAlerts = asyncHandler(async (req, res) => {
  const cached = cacheService.getLowStockCache();
  if (cached.updatedAt && req.query.force !== 'true') {
    return res.status(200).json({
      success: true,
      data: cached.data,
      items: cached.data,
      total: cached.data.length,
      page: 1,
      pageSize: cached.data.length,
      totalPages: 1,
      updatedAt: cached.updatedAt,
      source: 'cache'
    });
  }
  const data = await inventoryService.scanLowStockVariants();
  cacheService.setLowStockCache(data);
  return res.status(200).json({
    success: true,
    data,
    items: data,
    total: data.length,
    page: 1,
    pageSize: data.length,
    totalPages: 1,
    updatedAt: new Date(),
    source: 'fresh'
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const query = {};
  if (req.query.role) query.role = req.query.role;
  if (req.query.status) query.accountStatus = req.query.status;
  if (req.query.search) {
    query.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } }
    ];
  }
  const data = await userRepository.listUsers({ query, page, pageSize, skip });
  return res.status(200).json({ success: true, ...data });
});

const blockUser = asyncHandler(async (req, res) => {
  await userRepository.setBlockState(req.params.id, {
    block: !!req.body.block,
    reason: req.body.reason || ''
  });
  res.status(200).json({ success: true, message: req.body.block ? 'User blocked' : 'User unblocked' });
});

const updateUserRole = asyncHandler(async (req, res) => {
  const existingUser = await userRepository.findById(req.params.id);
  if (!existingUser) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  const user = await userRepository.updateById(req.params.id, { role: req.body.role });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  await auditLogService.createAuditLog({
    action: 'ROLE_CHANGE',
    performedBy: req.auth.userId,
    targetType: 'USER',
    targetId: req.params.id,
    previousValue: { role: existingUser.role },
    newValue: { role: user.role },
    req
  });
  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      email: user.email,
      role: user.role
    }
  });
});

const dashboardMetrics = asyncHandler(async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const [todayOrders, yesterdayOrders, lowStock, activeUsers] = await Promise.all([
    orderRepository.getOrdersRevenueSummary({ fromDate: todayStart }),
    orderRepository.getOrdersRevenueSummary({ fromDate: yesterdayStart, toDate: todayStart }),
    inventoryService.scanLowStockVariants(),
    userRepository.countActiveUsers()
  ]);

  const todayRevenue = todayOrders.revenue;
  const yesterdayRevenue = yesterdayOrders.revenue;
  const revenueDeltaPct = yesterdayRevenue ? Number((((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(2)) : 100;

  res.status(200).json({
    success: true,
    data: {
      todayRevenue,
      todayOrders: todayOrders.orders,
      activeUsers,
      lowStockCount: lowStock.length,
      revenueDeltaPct
    }
  });
});

const dashboardAnalytics = asyncHandler(async (req, res) => {
  const rangeDays = Number(req.query.rangeDays || 30);
  const allowedRange = [7, 30, 90].includes(rangeDays) ? rangeDays : 30;
  const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
  const toDate = req.query.toDate ? new Date(req.query.toDate) : null;

  const startDate = fromDate || (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (allowedRange - 1));
    return d;
  })();
  const endDate = toDate || null;
  const orderMatch = { createdAt: { $gte: startDate } };
  if (endDate) {
    orderMatch.createdAt.$lte = endDate;
  }

  const [metricsRes, revenueSeries, ordersByStatus, topSellingProducts, lowStock, recentOrders] = await Promise.all([
    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const [todayOrders, yesterdayOrders, activeUsers] = await Promise.all([
        orderRepository.getOrdersRevenueSummary({ fromDate: todayStart }),
        orderRepository.getOrdersRevenueSummary({ fromDate: yesterdayStart, toDate: todayStart }),
        userRepository.countActiveUsers()
      ]);
      const todayRevenue = todayOrders.revenue;
      const yesterdayRevenue = yesterdayOrders.revenue;
      return {
        todayRevenue,
        todayOrders: todayOrders.orders,
        activeUsers,
        revenueDeltaPct: yesterdayRevenue ? Number((((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(2)) : 100
      };
    })(),
    fromDate || toDate
      ? orderRepository.getRevenueSeriesByRange({ fromDate, toDate })
      : orderRepository.getRevenueSeriesByDay({ days: allowedRange }),
    orderRepository.getOrdersByStatus(orderMatch),
    orderRepository.getTopSellingProductsFromOrders(10, orderMatch),
    inventoryService.scanLowStockVariants(),
    orderRepository.listRecentOrders(10, orderMatch)
  ]);

  res.status(200).json({
    success: true,
    data: {
      metrics: { ...metricsRes, lowStockCount: lowStock.length },
      revenueSeries,
      ordersByStatus,
      topSellingProducts,
      lowStock,
      recentOrders
    }
  });
});

const listStockMovements = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const query = {};
  if (req.query.productId) query.productId = req.query.productId;
  if (req.query.variantId) query.variantId = req.query.variantId;
  if (req.query.reason) query.reason = req.query.reason;
  const data = await stockMovementRepository.listMovements({ query, page, pageSize, skip });
  res.status(200).json({ success: true, ...data });
});

const listPendingSellerProducts = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const data = await catalogAdminRepository.listPendingSellerProducts({ page, pageSize, skip });
  res.status(200).json({ success: true, ...data });
});

const reviewSellerProduct = asyncHandler(async (req, res) => {
  const product = await catalogAdminRepository.getProductById(req.params.id);
  if (!product) throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
  const previous = {
    adminApproved: product.adminApproved,
    isActive: product.isActive,
    adminReviewNote: product.adminReviewNote
  };

  const action = req.body.action;
  const note = req.body.note || '';
  if (action === 'APPROVE') {
    product.adminApproved = true;
    product.isActive = true;
  } else {
    product.adminApproved = false;
    product.isActive = false;
  }
  product.adminReviewNote = note;
  await catalogAdminRepository.saveProduct(product);
  await auditLogService.createAuditLog({
    action: action === 'APPROVE' ? 'PRODUCT_APPROVE' : 'PRODUCT_REJECT',
    performedBy: req.auth.userId,
    targetType: 'PRODUCT',
    targetId: req.params.id,
    previousValue: previous,
    newValue: {
      adminApproved: product.adminApproved,
      isActive: product.isActive,
      adminReviewNote: product.adminReviewNote
    },
    req
  });
  res.status(200).json({ success: true, data: product.toObject() });
});

const listBanners = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const data = await bannerRepository.listAllBannersPaged({ page, pageSize, skip });
  res.status(200).json({ success: true, data: data.items, ...data });
});

const reorderBanners = asyncHandler(async (req, res) => {
  const data = await catalogAdminRepository.reorderBanners(req.body.bannerIds || []);
  await auditLogService.createAuditLog({
    action: 'BANNER_REORDER',
    performedBy: req.auth.userId,
    targetType: 'BANNER',
    targetId: 'bulk',
    previousValue: null,
    newValue: { bannerIds: req.body.bannerIds || [] },
    req
  });
  res.status(200).json({ success: true, data });
});

const createProductCsvUploadJob = asyncHandler(async (req, res) => {
  const job = await adminImportService.createProductCsvImportJob({
    csvContent: req.body.csvContent,
    actor: req.auth
  });
  res.status(202).json({ success: true, data: { jobId: job._id, status: job.status } });
});

const getProductCsvUploadJob = asyncHandler(async (req, res) => {
  const data = await adminImportService.getImportJobStatus(req.params.jobId);
  if (!data) throw new AppError('Import job not found', 404, 'IMPORT_JOB_NOT_FOUND');
  res.status(200).json({ success: true, data });
});

const productCsvTemplate = asyncHandler(async (_req, res) => {
  const template = adminImportService.getProductCsvTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="product_template.csv"');
  res.status(200).send(template);
});

const getCsvUploadFailureReport = asyncHandler(async (req, res) => {
  const data = await adminImportService.getImportJobStatus(req.params.jobId);
  if (!data) throw new AppError('Import job not found', 404, 'IMPORT_JOB_NOT_FOUND');
  const rows = (data.failureReport || []).map((item) => ({
    rowNumber: item.rowNumber,
    reason: item.reason
  }));
  const csv = toCsv(['rowNumber', 'reason'], rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="import_failures_${req.params.jobId}.csv"`);
  res.status(200).send(csv);
});

const createStockCsvUploadJob = asyncHandler(async (req, res) => {
  const job = await adminImportService.createStockCsvImportJob({
    csvContent: req.body.csvContent,
    actor: req.auth
  });
  res.status(202).json({ success: true, data: { jobId: job._id, status: job.status } });
});

const stockCsvTemplate = asyncHandler(async (_req, res) => {
  const template = adminImportService.getStockCsvTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="stock_template.csv"');
  res.status(200).send(template);
});

const updateLowStockThreshold = asyncHandler(async (req, res) => {
  const data = await catalogAdminService.updateLowStockThreshold({
    productId: req.body.productId,
    threshold: req.body.threshold
  });
  res.status(200).json({ success: true, data });
});

const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const data = await auditLogService.listAuditLogs({ page, pageSize, skip });
  res.status(200).json({ success: true, ...data });
});

const getHomeFeaturedConfig = asyncHandler(async (_req, res) => {
  const data = await homeFeaturedRepository.getConfig();
  res.status(200).json({ success: true, data });
});

const upsertHomeFeaturedConfig = asyncHandler(async (req, res) => {
  const data = await homeFeaturedRepository.upsertConfig(req.body.items || []);
  res.status(200).json({ success: true, data });
});

module.exports = {
  listOrders,
  lowStockAlerts,
  listUsers,
  blockUser,
  updateUserRole,
  dashboardMetrics,
  dashboardAnalytics,
  listStockMovements,
  listPendingSellerProducts,
  reviewSellerProduct,
  listBanners,
  reorderBanners,
  createProductCsvUploadJob,
  getProductCsvUploadJob,
  productCsvTemplate,
  getCsvUploadFailureReport,
  createStockCsvUploadJob,
  stockCsvTemplate,
  updateLowStockThreshold,
  listAuditLogs,
  getHomeFeaturedConfig,
  upsertHomeFeaturedConfig
};
