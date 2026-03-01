const mongoose = require('mongoose');
const { ROLES } = require('../utils/constants');

const canonicalizeRole = (role) => String(role || '').trim().toLowerCase();

const addressSchema = new mongoose.Schema(
  {
    addressId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    label: { type: String, default: 'Home' },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    isDefault: { type: Boolean, default: false }
  },
  { _id: false }
);

const savedCardSchema = new mongoose.Schema(
  {
    cardId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    last4: { type: String, required: true },
    brand: { type: String, required: true },
    expiryMonth: { type: Number, required: true, min: 1, max: 12 },
    expiryYear: { type: Number, required: true },
    gatewayToken: { type: String, required: true, select: false },
    isDefault: { type: Boolean, default: false }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, index: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: [ROLES.ADMIN, ROLES.CUSTOMER, ROLES.SELLER], default: ROLES.CUSTOMER, index: true },
    profileImage: { type: String, default: '' },
    addresses: { type: [addressSchema], default: [] },
    savedCards: { type: [savedCardSchema], default: [] },
    notificationPreferences: {
      emailOrders: { type: Boolean, default: true },
      emailPromotions: { type: Boolean, default: true },
      smsOrders: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: false }
    },
    twoFactorEnabled: { type: Boolean, default: false },
    privacySettings: {
      dataDownloadRequested: { type: Boolean, default: false },
      deleteAccountRequested: { type: Boolean, default: false },
      deleteRequestedAt: { type: Date, default: null }
    },
    accountStatus: {
      type: String,
      enum: ['ACTIVE', 'BLOCKED', 'PENDING_DELETION', 'DELETED'],
      default: 'ACTIVE',
      index: true
    },
    blockReason: { type: String, default: '' },
    refreshTokens: { type: [String], select: false, default: [] },
    recentlyViewed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    failedLoginAttempts: { type: Number, default: 0 },
    loginLockedUntil: { type: Date, default: null },
    lastLogin: { type: Date, default: null }
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ accountStatus: 1 });
userSchema.index({ createdAt: -1 });

userSchema.pre('validate', function normalizeUserRole() {
  this.role = canonicalizeRole(this.role);
});

module.exports = mongoose.model('User', userSchema);
