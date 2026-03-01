const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');

const normalizePaymentStatus = (status) => String(status || '').trim().toUpperCase();
const SUCCESS_PAYMENT_STATUSES = new Set(['SUCCESS', 'COMPLETED', 'PAID']);
const FAILED_PAYMENT_STATUSES = new Set(['FAILED']);
const NON_REPEATABLE_PAYMENT_STATUSES = new Set(['PENDING', 'INITIATED', 'SUCCESS', 'COMPLETED', 'PAID']);

const restoreOrderStock = async (order) => {
  for (const item of order.items) {
    const updated = await Product.updateOne(
      { _id: item.productId },
      { $inc: { stock: Number(item.quantity || 0) } }
    );
    if (!updated.modifiedCount) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }
  }
};

const initiatePayment = async (req, res, next) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    const method = String(req.body?.method || '').trim().toUpperCase();

    if (!orderId || !method) {
      return res.status(400).json({ message: 'orderId and method are required' });
    }

    const order = await Order.findById(orderId).select('_id userId status totalAmount');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden access' });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const existingPayment = await Payment.findOne({ orderId }).select('status').lean();
    if (existingPayment && NON_REPEATABLE_PAYMENT_STATUSES.has(normalizePaymentStatus(existingPayment.status))) {
      return res.status(400).json({ message: 'Payment already initiated for this order' });
    }

    if (method === 'COD') {
      const payment = await Payment.create({
        orderId,
        userId: req.user._id,
        amount: order.totalAmount,
        method: 'COD',
        status: 'Pending'
      });

      return res.status(201).json({ message: 'COD payment initiated', payment });
    }

    const payment = await Payment.create({
      orderId,
      userId: req.user._id,
      amount: order.totalAmount,
      method,
      status: 'Initiated'
    });

    return res.status(201).json({
      message: 'Payment initiated',
      payment,
      stripe: {
        info: 'Basic Stripe flow placeholder',
        clientSecret: `mock_client_secret_${orderId}`
      }
    });
  } catch (error) {
    return next(error);
  }
};

const confirmPayment = async (req, res, next) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    const status = String(req.body?.status || '').trim();

    if (!orderId || !status) {
      return res.status(400).json({ message: 'orderId and status are required' });
    }

    const order = await Order.findById(orderId).select('_id userId status items');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden access' });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const normalizedStatus = normalizePaymentStatus(status);
    if (!normalizedStatus) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    let payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(400).json({ message: 'Payment not initiated for this order' });
    }

    if (SUCCESS_PAYMENT_STATUSES.has(normalizePaymentStatus(payment.status))) {
      return res.status(400).json({ message: 'Order already paid' });
    }

    payment.status = normalizedStatus;
    await payment.save();

    if (SUCCESS_PAYMENT_STATUSES.has(normalizedStatus)) {
      if (order.status === 'Pending') {
        order.status = 'Processing';
      }
    } else if (FAILED_PAYMENT_STATUSES.has(normalizedStatus)) {
      if (order.status === 'Pending' || order.status === 'Processing') {
        await restoreOrderStock(order);
      }
      order.status = 'Cancelled';
    }

    await order.save();

    return res.status(200).json({ payment, order });
  } catch (error) {
    return next(error);
  }
};

const getPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const payment = await Payment.findOne({ orderId }).lean();
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.userId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden access' });
    }

    return res.status(200).json(payment);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  initiatePayment,
  confirmPayment,
  getPaymentStatus
};
