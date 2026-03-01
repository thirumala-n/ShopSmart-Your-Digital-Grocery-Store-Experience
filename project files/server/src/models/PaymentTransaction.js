const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    externalOrderId: { type: String, default: '', index: true },
    externalPaymentId: { type: String, default: '', index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    gateway: { type: String, required: true, default: 'MOCK' },
    idempotencyKey: { type: String, default: '', index: true },
    idempotencyExpiresAt: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: ['CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUND_INITIATED', 'REFUNDED'],
      default: 'CREATED',
      index: true
    },
    refundReferenceId: { type: String, default: '' },
    metadata: { type: Object, default: {} }
  },
  { timestamps: true }
);

paymentTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string', $ne: '' } } }
);
paymentTransactionSchema.index({ idempotencyExpiresAt: 1 }, { expireAfterSeconds: 0 });
paymentTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
