const mongoose = require('mongoose');

const processedWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    provider: { type: String, required: true, default: 'UNKNOWN' },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

processedWebhookEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ProcessedWebhookEvent', processedWebhookEventSchema);
