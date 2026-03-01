const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');

const ALLOWED_ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const STATUS_BY_LOWER = ALLOWED_ORDER_STATUSES.reduce((acc, status) => {
  acc[status.toLowerCase()] = status;
  return acc;
}, {});
const STATUS_TRANSITIONS = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: []
};
const VALID_PAYMENT_METHODS = ['COD', 'STRIPE', 'CARD', 'UPI'];
const FREE_DELIVERY_THRESHOLD = 500;
const STANDARD_DELIVERY_FEE = 40;
const TAX_RATE = 0.05;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const SSE_HEARTBEAT_MS = 20000;

const SLOT_TO_ETA = {
  'Express (30-45 min)': '30-45 minutes',
  'Morning (7 AM - 10 AM)': 'Today, 7 AM - 10 AM',
  'Afternoon (12 PM - 3 PM)': 'Today, 12 PM - 3 PM',
  'Evening (6 PM - 9 PM)': 'Today, 6 PM - 9 PM'
};

const orderSseClients = new Map();

const supportsTransactions = () => {
  const topologyType = mongoose.connection?.client?.topology?.description?.type;
  return topologyType === 'ReplicaSetWithPrimary'
    || topologyType === 'ReplicaSetNoPrimary'
    || topologyType === 'Sharded';
};

const parsePagination = (req) => {
  const pageRaw = req.query.page;
  const limitRaw = req.query.limit;
  const page = pageRaw === undefined ? 1 : Number(pageRaw);
  const limit = limitRaw === undefined ? DEFAULT_PAGE_SIZE : Number(limitRaw);

  if (!Number.isInteger(page) || page < 1) {
    return { error: 'Invalid page. page must be a positive integer.' };
  }

  if (!Number.isInteger(limit) || limit < 1) {
    return { error: 'Invalid limit. limit must be a positive integer.' };
  }

  if (limit > MAX_PAGE_SIZE) {
    return { error: `Invalid limit. Maximum page size is ${MAX_PAGE_SIZE}.` };
  }

  return { page, limit };
};

const sanitizeText = (value, maxLength = 80) => String(value || '')
  .replace(/[^\w\s\-.,]/g, ' ')
  .trim()
  .slice(0, maxLength);

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toObjectIdOrNull = (value) => {
  const normalized = String(value || '').trim();
  return mongoose.isValidObjectId(normalized) ? new mongoose.Types.ObjectId(normalized) : null;
};

const calculateDiscount = (couponCode, subtotalAmount) => {
  const normalized = String(couponCode || '').trim().toUpperCase();

  if (!normalized) {
    return { code: '', amount: 0 };
  }
  if (normalized === 'STARTUP10') {
    return { code: normalized, amount: Math.min(200, Number((subtotalAmount * 0.1).toFixed(2))) };
  }
  if (normalized === 'FREESHIP') {
    return { code: normalized, amount: subtotalAmount >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE };
  }

  return { code: normalized, amount: 0 };
};

const removeSseClient = (userId, res) => {
  const bucket = orderSseClients.get(userId);
  if (!bucket) {
    return;
  }
  bucket.delete(res);
  if (!bucket.size) {
    orderSseClients.delete(userId);
  }
};

const emitOrderUpdate = (userId, payload) => {
  const bucket = orderSseClients.get(String(userId));
  if (!bucket || !bucket.size) {
    return;
  }
  const serialized = `event: order-status\nid: ${Date.now()}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of bucket) {
    if (client.writableEnded) {
      removeSseClient(String(userId), client);
      continue;
    }
    client.write(serialized);
  }
};

const restoreOrderStock = async (order, session) => {
  for (const item of order.items) {
    const updateOptions = session ? { session } : {};
    const updated = await Product.updateOne(
      { _id: item.productId },
      { $inc: { stock: Number(item.quantity || 0), soldCount: -Number(item.quantity || 0) } },
      updateOptions
    );
    if (!updated.modifiedCount) {
      const error = new Error('Product not found while restoring stock');
      error.statusCode = 404;
      throw error;
    }
  }
};

const placeOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  const useTransaction = supportsTransactions();
  try {
    const shippingAddress = sanitizeText(req.body?.shippingAddress, 400);
    const paymentMethod = String(req.body?.paymentMethod || '').trim().toUpperCase();
    const couponCode = sanitizeText(req.body?.couponCode, 20).toUpperCase();
    const deliverySlot = sanitizeText(req.body?.deliverySlot, 60);
    const address = req.body?.address || {};

    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({ message: 'shippingAddress and paymentMethod are required' });
    }
    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    if (useTransaction) {
      session.startTransaction();
    }

    let cartQuery = Cart.findOne({ userId: req.user._id })
      .populate('items.productId', 'name price stock');
    if (useTransaction) {
      cartQuery = cartQuery.session(session);
    }
    const cart = await cartQuery;
    if (!cart || !Array.isArray(cart.items) || !cart.items.length) {
      if (useTransaction) {
        await session.abortTransaction();
      }
      return res.status(400).json({ message: 'Cart is empty' });
    }

    let subtotalAmount = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const productId = String(item.productId?._id || '');
      const quantity = Number(item.quantity || 0);
      if (!mongoose.isValidObjectId(productId) || !Number.isInteger(quantity) || quantity < 1) {
        if (useTransaction) {
          await session.abortTransaction();
        }
        return res.status(400).json({ message: 'Invalid cart item state' });
      }

      const updateOptions = useTransaction
        ? { new: true, session, select: 'name price stock' }
        : { new: true, select: 'name price stock' };
      const product = await Product.findOneAndUpdate(
        { _id: productId, stock: { $gte: quantity }, isAvailable: true },
        { $inc: { stock: -quantity, soldCount: quantity } },
        updateOptions
      );

      if (!product) {
        if (useTransaction) {
          await session.abortTransaction();
        }
        return res.status(409).json({ message: 'Insufficient stock for one or more items' });
      }

      const unitPrice = Number(product.price || 0);
      orderItems.push({
        productId: product._id,
        quantity,
        price: unitPrice
      });
      subtotalAmount += unitPrice * quantity;
    }

    const discountData = calculateDiscount(couponCode, subtotalAmount);
    const taxableAmount = Math.max(subtotalAmount - discountData.amount, 0);
    const taxAmount = Number((taxableAmount * TAX_RATE).toFixed(2));
    const deliveryCharge = subtotalAmount >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
    const totalAmount = Number((taxableAmount + taxAmount + deliveryCharge).toFixed(2));

    const createOptions = useTransaction ? { session } : undefined;
    const createdOrder = await Order.create([{
      userId: req.user._id,
      items: orderItems,
      shippingAddress,
      shippingAddressSnapshot: {
        fullName: sanitizeText(address.fullName, 80),
        phone: sanitizeText(address.phone, 30),
        line1: sanitizeText(address.line1, 120),
        line2: sanitizeText(address.line2, 120),
        city: sanitizeText(address.city, 80),
        state: sanitizeText(address.state, 80),
        postalCode: sanitizeText(address.postalCode, 20),
        landmark: sanitizeText(address.landmark, 100)
      },
      paymentMethod,
      couponCode: discountData.code,
      subtotalAmount,
      discountAmount: discountData.amount,
      taxAmount,
      deliveryCharge,
      deliverySlot,
      eta: SLOT_TO_ETA[deliverySlot] || 'ETA will be assigned soon',
      totalAmount,
      status: 'Pending'
    }], createOptions);

    cart.items = [];
    if (useTransaction) {
      await cart.save({ session });
    } else {
      await cart.save();
    }

    if (useTransaction) {
      await session.commitTransaction();
    }

    const order = createdOrder[0].toObject();
    emitOrderUpdate(String(order.userId), {
      orderId: String(order._id),
      status: order.status,
      updatedAt: new Date().toISOString()
    });

    return res.status(201).json(order);
  } catch (error) {
    if (useTransaction) {
      await session.abortTransaction();
    }
    return next(error);
  } finally {
    session.endSession();
  }
};

const getUserOrders = async (req, res, next) => {
  try {
    const pagination = parsePagination(req);
    if (pagination.error) {
      return res.status(400).json({ message: pagination.error });
    }
    const { page, limit } = pagination;

    const [items, total] = await Promise.all([
      Order.find({ userId: req.user._id })
        .select('items shippingAddress paymentMethod totalAmount status createdAt eta subtotalAmount taxAmount deliveryCharge discountAmount')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('items.productId', 'name image brand')
        .lean(),
      Order.countDocuments({ userId: req.user._id })
    ]);

    return res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    return next(error);
  }
};

const getAllOrders = async (req, res, next) => {
  try {
    const pagination = parsePagination(req);
    if (pagination.error) {
      return res.status(400).json({ message: pagination.error });
    }
    const { page, limit } = pagination;
    const statusFilter = sanitizeText(req.query.status, 30);
    const search = sanitizeText(req.query.search, 80);
    const filters = {};

    if (statusFilter) {
      filters.status = STATUS_BY_LOWER[statusFilter.toLowerCase()] || statusFilter;
    }
    if (search) {
      const maybeId = toObjectIdOrNull(search);
      if (maybeId) {
        filters.$or = [{ _id: maybeId }, { userId: maybeId }];
      } else {
        filters.shippingAddress = { $regex: escapeRegex(search), $options: 'i' };
      }
    }

    const [items, total] = await Promise.all([
      Order.find(filters)
        .select('userId totalAmount status createdAt shippingAddress paymentMethod')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name email')
        .lean(),
      Order.countDocuments(filters)
    ]);

    return res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    return next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  const useTransaction = supportsTransactions();
  try {
    if (!req.user || String(req.user.role || '').toUpperCase() !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const status = STATUS_BY_LOWER[String(req.body?.status || '').trim().toLowerCase()];
    if (!status) {
      return res.status(400).json({ message: 'status is required' });
    }

    if (useTransaction) {
      session.startTransaction();
    }
    let orderQuery = Order.findById(req.params.id);
    if (useTransaction) {
      orderQuery = orderQuery.session(session);
    }
    const order = await orderQuery;
    if (!order) {
      if (useTransaction) {
        await session.abortTransaction();
      }
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status === 'Delivered' || order.status === 'Cancelled') {
      if (useTransaction) {
        await session.abortTransaction();
      }
      return res.status(400).json({ message: 'Order can no longer be modified' });
    }

    const allowed = STATUS_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      if (useTransaction) {
        await session.abortTransaction();
      }
      return res.status(400).json({ message: 'Invalid status transition' });
    }

    if (status === 'Cancelled' && ['Pending', 'Processing'].includes(order.status)) {
      await restoreOrderStock(order, useTransaction ? session : null);
    }

    order.status = status;
    if (useTransaction) {
      await order.save({ session });
      await session.commitTransaction();
    } else {
      await order.save();
    }

    emitOrderUpdate(String(order.userId), {
      orderId: String(order._id),
      status: order.status,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json(order.toObject());
  } catch (error) {
    if (useTransaction) {
      await session.abortTransaction();
    }
    return next(error);
  } finally {
    session.endSession();
  }
};

const cancelOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  const useTransaction = supportsTransactions();
  try {
    if (useTransaction) {
      session.startTransaction();
    }
    let orderQuery = Order.findById(req.params.id);
    if (useTransaction) {
      orderQuery = orderQuery.session(session);
    }
    const order = await orderQuery;
    if (!order) {
      if (useTransaction) {
        await session.abortTransaction();
      }
      return res.status(404).json({ message: 'Order not found' });
    }
    const isAdmin = String(req.user?.role || '').toUpperCase() === 'ADMIN';
    const isOwner = String(order.userId) === String(req.user?._id);
    if (!isOwner && !isAdmin) {
      if (useTransaction) {
        await session.abortTransaction();
      }
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (order.status === 'Cancelled') {
      if (useTransaction) {
        await session.abortTransaction();
      }
      return res.status(400).json({ message: 'Order already cancelled' });
    }
    if (!['Pending', 'Processing'].includes(order.status)) {
      if (useTransaction) {
        await session.abortTransaction();
      }
      return res.status(400).json({ message: 'Invalid status transition' });
    }

    await restoreOrderStock(order, useTransaction ? session : null);
    order.status = 'Cancelled';
    if (useTransaction) {
      await order.save({ session });
      await session.commitTransaction();
    } else {
      await order.save();
    }

    emitOrderUpdate(String(order.userId), {
      orderId: String(order._id),
      status: order.status,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json(order.toObject());
  } catch (error) {
    if (useTransaction) {
      await session.abortTransaction();
    }
    return next(error);
  } finally {
    session.endSession();
  }
};

const getOrderTracking = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .select('userId status eta deliverySlot')
      .lean();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const isAdmin = String(req.user?.role || '').toUpperCase() === 'ADMIN';
    if (!isAdmin && String(order.userId) !== String(req.user?._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const timeline = [
      { status: 'Pending', label: 'Order Placed', active: true },
      { status: 'Processing', label: 'Packed at warehouse', active: ['Processing', 'Shipped', 'Delivered'].includes(order.status) },
      { status: 'Shipped', label: 'Out for delivery', active: ['Shipped', 'Delivered'].includes(order.status) },
      { status: 'Delivered', label: 'Delivered', active: order.status === 'Delivered' }
    ];
    if (order.status === 'Cancelled') {
      timeline.push({ status: 'Cancelled', label: 'Order Cancelled', active: true });
    }

    return res.status(200).json({
      orderId: String(order._id),
      status: order.status,
      eta: order.eta || '',
      deliverySlot: order.deliverySlot || '',
      timeline
    });
  } catch (error) {
    return next(error);
  }
};

const getOrderAnalytics = async (req, res, next) => {
  try {
    if (!req.user || String(req.user.role || '').toUpperCase() !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [summary, todaySales, statusBreakdown, monthlyRevenue, topProducts] = await Promise.all([
      Order.aggregate([{ $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, todaySales: { $sum: '$totalAmount' }, todayOrders: { $sum: 1 } } }
      ]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Order.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            revenue: { $sum: '$totalAmount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Order.aggregate([
        { $unwind: '$items' },
        { $group: { _id: '$items.productId', quantity: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } } } },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $project: { _id: 0, productId: '$product._id', name: '$product.name', quantity: 1, revenue: 1 } }
      ])
    ]);

    return res.status(200).json({
      overview: {
        totalRevenue: Number(summary[0]?.revenue || 0),
        totalOrders: Number(summary[0]?.orders || 0),
        todaySales: Number(todaySales[0]?.todaySales || 0),
        todayOrders: Number(todaySales[0]?.todayOrders || 0)
      },
      orderStatusChart: statusBreakdown.map((item) => ({ status: item._id, count: item.count })),
      monthlyRevenueChart: monthlyRevenue.map((item) => ({
        label: `${item._id.month}/${item._id.year}`,
        revenue: Number(item.revenue || 0)
      })),
      topProducts
    });
  } catch (error) {
    return next(error);
  }
};

const streamOrderStatus = async (req, res, next) => {
  try {
    const userId = String(req.user?._id || '');
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`);

    const existing = orderSseClients.get(userId) || new Set();
    existing.add(res);
    orderSseClients.set(userId, existing);

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': ping\n\n');
      }
    }, SSE_HEARTBEAT_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeSseClient(userId, res);
    });
  } catch (error) {
    return next(error);
  }
};

const downloadInvoice = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .select('userId items shippingAddress shippingAddressSnapshot paymentMethod totalAmount createdAt subtotalAmount taxAmount deliveryCharge discountAmount status')
      .populate('items.productId', 'name')
      .populate('userId', 'name email')
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isAdmin = String(req.user?.role || '').toUpperCase() === 'ADMIN';
    if (!isAdmin && String(order.userId?._id || order.userId) !== String(req.user?._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${String(order._id)}.pdf`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.on('error', (error) => next(error));
    doc.pipe(res);

    doc.fontSize(18).text('Grocery Startup Invoice', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Order ID: ${order._id}`);
    doc.text(`Date: ${new Date(order.createdAt).toISOString()}`);
    doc.text(`Status: ${order.status}`);
    doc.text(`Customer: ${order.userId?.name || ''} (${order.userId?.email || ''})`);
    doc.moveDown(0.5);
    doc.text('Shipping Address:');
    doc.text(order.shippingAddress || '');
    if (order.shippingAddressSnapshot) {
      doc.text(`${order.shippingAddressSnapshot.line1 || ''} ${order.shippingAddressSnapshot.line2 || ''}`.trim());
      doc.text(`${order.shippingAddressSnapshot.city || ''}, ${order.shippingAddressSnapshot.state || ''} ${order.shippingAddressSnapshot.postalCode || ''}`.trim());
    }
    doc.moveDown(0.8);

    doc.fontSize(11).text('Items');
    doc.moveDown(0.3);
    doc.fontSize(10).text('Name', 40, doc.y, { continued: true });
    doc.text('Qty', 300, doc.y, { continued: true });
    doc.text('Unit', 350, doc.y, { continued: true });
    doc.text('Total', 440, doc.y);
    doc.moveDown(0.2);

    for (const item of order.items || []) {
      const name = item.productId?.name || 'Product';
      const qty = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      doc.text(name, 40, doc.y, { continued: true, width: 240 });
      doc.text(String(qty), 300, doc.y, { continued: true, width: 40 });
      doc.text(price.toFixed(2), 350, doc.y, { continued: true, width: 70 });
      doc.text((qty * price).toFixed(2), 440, doc.y, { width: 80 });
      if (doc.y > 740) {
        doc.addPage();
      }
    }

    doc.moveDown(0.8);
    doc.text(`Subtotal: ${Number(order.subtotalAmount || 0).toFixed(2)}`, { align: 'right' });
    doc.text(`Discount: -${Number(order.discountAmount || 0).toFixed(2)}`, { align: 'right' });
    doc.text(`Tax: ${Number(order.taxAmount || 0).toFixed(2)}`, { align: 'right' });
    doc.text(`Delivery: ${Number(order.deliveryCharge || 0).toFixed(2)}`, { align: 'right' });
    doc.fontSize(12).text(`Grand Total: ${Number(order.totalAmount || 0).toFixed(2)}`, { align: 'right' });
    doc.moveDown(0.6);
    doc.fontSize(9).text(`Payment Method: ${order.paymentMethod}`, { align: 'right' });

    doc.end();
  } catch (error) {
    return next(error);
  }
};

const getSellerOrders = async (req, res, next) => {
  try {
    const sellerId = req.user._id;
    const { page = 1, limit = DEFAULT_PAGE_SIZE, status } = req.query;

    const parsedPagination = parsePagination({ query: { page, limit } });
    if (parsedPagination.error) {
      return res.status(400).json({ message: parsedPagination.error });
    }

    const matchStage = {
      'productDetails.sellerId': sellerId
    };

    if (status && ALLOWED_ORDER_STATUSES.includes(status)) {
      matchStage.status = status;
    }

    const orders = await Order.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $match: matchStage
      },
      {
        $addFields: {
          items: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    productDetails: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$productDetails',
                            cond: { $eq: ['$$this._id', '$$item.productId'] }
                          }
                        },
                        0
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $skip: (parsedPagination.page - 1) * parsedPagination.limit
      },
      {
        $limit: parsedPagination.limit
      }
    ]);

    const total = await Order.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $match: {
          'productDetails.sellerId': sellerId,
          ...(status && ALLOWED_ORDER_STATUSES.includes(status) && { status })
        }
      },
      {
        $count: 'total'
      }
    ]);

    return res.status(200).json({
      orders,
      pagination: {
        page: parsedPagination.page,
        limit: parsedPagination.limit,
        total: total[0]?.total || 0,
        pages: Math.ceil((total[0]?.total || 0) / parsedPagination.limit)
      }
    });
  } catch (error) {
    return next(error);
  }
};

const updateSellerOrderStatus = async (req, res, next) => {
  try {
    const sellerId = req.user._id;
    const { id } = req.params;
    const { status } = req.body;

    if (!ALLOWED_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Check if the order contains products from this seller
    const order = await Order.findOne({
      _id: id,
      'items.productId': { $exists: true }
    }).populate('items.productId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const hasSellerProducts = order.items.some(item =>
      item.productId && item.productId.sellerId && item.productId.sellerId.toString() === sellerId.toString()
    );

    if (!hasSellerProducts) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if status transition is allowed
    if (!STATUS_TRANSITIONS[order.status]?.includes(status)) {
      return res.status(400).json({
        message: `Cannot change status from ${order.status} to ${status}`
      });
    }

    order.status = status;
    await order.save();

    return res.status(200).json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  placeOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  getOrderTracking,
  getOrderAnalytics,
  streamOrderStatus,
  downloadInvoice,
  getSellerOrders,
  updateSellerOrderStatus
};
