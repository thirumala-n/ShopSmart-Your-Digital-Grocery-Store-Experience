const mongoose = require('mongoose');

const profileOtpSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: ['EMAIL_CHANGE', 'PHONE_CHANGE'], required: true, index: true },
    targetValue: { type: String, required: true, trim: true, index: true },
    otpHash: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
    verifiedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

profileOtpSchema.index({ userId: 1, purpose: 1, targetValue: 1, createdAt: -1 });

module.exports = mongoose.model('ProfileOtp', profileOtpSchema);
