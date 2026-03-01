const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true, min: 0 }
    }
  ],
  shippingAddress: { type: String, required: true },
  shippingAddressSnapshot: {
    fullName: { type: String, default: '' },
    phone: { type: String, default: '' },
    line1: { type: String, default: '' },
    line2: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    postalCode: { type: String, default: '' },
    landmark: { type: String, default: '' }
  },
  couponCode: { type: String, default: '' },
  subtotalAmount: { type: Number, required: true, min: 0, default: 0 },
  discountAmount: { type: Number, required: true, min: 0, default: 0 },
  taxAmount: { type: Number, required: true, min: 0, default: 0 },
  deliveryCharge: { type: Number, required: true, min: 0, default: 0 },
  deliverySlot: { type: String, default: '' },
  eta: { type: String, default: '' },
  paymentMethod: { type: String, required: true },
  totalAmount: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  createdAt: { type: Date, default: Date.now }
});

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
