const mongoose = require('mongoose');

const policyContentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ['RETURN_REFUND_POLICY', 'DELIVERY_INFORMATION', 'CANCELLATION_POLICY', 'COOKIE_POLICY']
    },
    title: { type: String, required: true },
    contentHtml: { type: String, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PolicyContent', policyContentSchema);
