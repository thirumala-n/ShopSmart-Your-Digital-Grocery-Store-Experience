const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    delta: { type: Number, required: true },
    reason: { type: String, required: true },
    referenceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ variantId: 1, createdAt: -1 });
stockMovementSchema.index({ reason: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
