const mongoose = require('mongoose');

const childSummarySchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderStatus: { type: String, required: true },
    paymentStatus: { type: String, required: true },
    totalAmount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const parentOrderSchema = new mongoose.Schema(
  {
    orderGroupId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    childOrderIds: [{ type: String, required: true }],
    childSummaries: { type: [childSummarySchema], default: [] },
    aggregateOrderStatus: { type: String, required: true, index: true },
    aggregatePaymentStatus: { type: String, required: true, index: true },
    paymentMethod: { type: String, enum: ['COD', 'ONLINE'], required: true },
    shippingAddress: {
      label: { type: String, default: 'Home' },
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      line2: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true }
    },
    deliverySlot: {
      date: { type: Date, required: true },
      timeWindow: { type: String, required: true }
    },
    deliverySlotReleased: { type: Boolean, default: false },
    totalMRP: { type: Number, required: true, min: 0 },
    totalDiscount: { type: Number, required: true, min: 0 },
    couponCode: { type: String, default: '' },
    couponDiscount: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

parentOrderSchema.index({ userId: 1, createdAt: -1 });
parentOrderSchema.index({ userId: 1, aggregateOrderStatus: 1, createdAt: -1 });

module.exports = mongoose.model('ParentOrder', parentOrderSchema);
