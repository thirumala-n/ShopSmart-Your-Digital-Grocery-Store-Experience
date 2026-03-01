const mongoose = require('mongoose');

const stockAlertSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

stockAlertSubscriptionSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('StockAlertSubscription', stockAlertSubscriptionSchema);
