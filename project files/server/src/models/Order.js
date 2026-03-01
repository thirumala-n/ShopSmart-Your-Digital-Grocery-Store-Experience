const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true, enum: Object.values(ORDER_STATUS) },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    variantLabel: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    unitMRP: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    sellerName: { type: String, required: true }
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Home' },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    orderGroupId: { type: String, default: '', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderItems: { type: [orderItemSchema], required: true, validate: [(arr) => arr.length > 0, 'Order items required'] },
    shippingAddress: { type: addressSchema, required: true },
    deliverySlot: {
      date: { type: Date, required: true },
      timeWindow: { type: String, required: true }
    },
    paymentMethod: { type: String, required: true, enum: ['COD', 'ONLINE'] },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING, index: true },
    paymentGatewayOrderId: { type: String, default: '' },
    paymentGatewayPaymentId: { type: String, default: '' },
    refundReferenceId: { type: String, default: '' },
    orderStatus: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.PENDING_PAYMENT, index: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
    trackingId: { type: String, default: '' },
    totalMRP: { type: Number, required: true, min: 0 },
    totalDiscount: { type: Number, required: true, min: 0, default: 0 },
    couponCode: { type: String, default: '' },
    couponDiscount: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    deliveryOTP: { type: String, select: false },
    deliveryOTPExpiry: { type: Date },
    otpAttemptCount: { type: Number, default: 0 },
    otpLockedUntil: { type: Date, default: null }
  },
  { timestamps: true }
);

orderSchema.index({ userId: 1 });
orderSchema.index({ sellerId: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: 1 });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ userId: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1, paymentStatus: 1 });

module.exports = mongoose.model('Order', orderSchema);
