const bcrypt = require('bcryptjs');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');
const recentlyViewedRepository = require('../repositories/recentlyViewedRepository');
const profileOtpRepository = require('../repositories/profileOtpRepository');
const { generateNumericOtp } = require('../utils/crypto');
const { sendEmail } = require('./emailService');
const notificationService = require('./notificationService');

const getProfile = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user;
};

const updateProfile = async ({ userId, name, email, phone, profileImage }) => {
  const existingUser = await userRepository.findById(userId);
  if (!existingUser) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  const updates = {};
  if (name) updates.name = name;

  if (email) {
    const normalizedEmail = String(email).toLowerCase();
    if (normalizedEmail !== String(existingUser.email || '').toLowerCase()) {
      const verified = await profileOtpRepository.findLatestVerified({
        userId,
        purpose: 'EMAIL_CHANGE',
        targetValue: normalizedEmail,
        since: new Date(Date.now() - 15 * 60 * 1000)
      });
      if (!verified) {
        throw new AppError('Email OTP verification required', 400, 'EMAIL_OTP_REQUIRED');
      }
    }
    updates.email = normalizedEmail;
  }

  if (phone) {
    if (String(phone) !== String(existingUser.phone || '')) {
      const verified = await profileOtpRepository.findLatestVerified({
        userId,
        purpose: 'PHONE_CHANGE',
        targetValue: String(phone),
        since: new Date(Date.now() - 15 * 60 * 1000)
      });
      if (!verified) {
        throw new AppError('Phone OTP verification required', 400, 'PHONE_OTP_REQUIRED');
      }
    }
    updates.phone = phone;
  }

  if (profileImage !== undefined) updates.profileImage = profileImage;
  const user = await userRepository.updateById(userId, updates);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user;
};

const setNotificationPreferences = async ({ userId, notificationPreferences }) => {
  const user = await userRepository.updateById(userId, { notificationPreferences });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user.notificationPreferences;
};

const updateAddresses = async ({ userId, addresses }) => {
  if (!Array.isArray(addresses)) {
    throw new AppError('Addresses must be an array', 400, 'INVALID_ADDRESSES');
  }
  let normalized = addresses.map((item) => ({ ...item }));
  if (normalized.length > 0) {
    const defaultCount = normalized.filter((item) => !!item.isDefault).length;
    if (defaultCount === 0) normalized[0].isDefault = true;
    if (defaultCount > 1) {
      let seenDefault = false;
      normalized = normalized.map((item) => {
        if (item.isDefault && !seenDefault) {
          seenDefault = true;
          return item;
        }
        return { ...item, isDefault: false };
      });
    }
  }
  const user = await userRepository.updateById(userId, { addresses: normalized });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user.addresses;
};

const setTwoFactor = async ({ userId, enabled }) => {
  const user = await userRepository.updateById(userId, { twoFactorEnabled: !!enabled });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return { twoFactorEnabled: !!user.twoFactorEnabled };
};

const listActiveSessions = async (userId) => {
  const user = await userRepository.findByIdForAccountSecurity(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  const tokenCount = Array.isArray(user.refreshTokens) ? user.refreshTokens.length : 0;
  return Array.from({ length: Math.max(tokenCount, 1) }).map((_, index) => ({
    sessionId: `session_${index + 1}`,
    deviceName: index === 0 ? 'Current Device' : `Device ${index + 1}`,
    location: 'Unknown',
    lastActiveAt: user.lastLogin || user.updatedAt || user.createdAt,
    isCurrent: index === 0
  }));
};

const listSavedCards = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return (user.savedCards || []).map((card) => ({
    cardId: card.cardId,
    last4: card.last4,
    brand: card.brand,
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
    isDefault: !!card.isDefault
  }));
};

const addSavedCard = async ({ userId, card }) => {
  const user = await userRepository.findByIdForAccountSecurity(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  const exists = (user.savedCards || []).some((existing) => existing.gatewayToken === card.gatewayToken);
  if (exists) throw new AppError('Card already exists', 409, 'CARD_EXISTS');

  const nextCards = [...(user.savedCards || []), card];
  if (card.isDefault) {
    nextCards.forEach((item) => {
      if (item.gatewayToken !== card.gatewayToken) item.isDefault = false;
    });
  }
  if (nextCards.length > 0 && !nextCards.some((item) => item.isDefault)) nextCards[0].isDefault = true;
  user.savedCards = nextCards;
  await userRepository.saveUser(user);
  return listSavedCards(userId);
};

const removeSavedCard = async ({ userId, cardId }) => {
  const user = await userRepository.findByIdForAccountSecurity(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  const before = user.savedCards || [];
  const next = before.filter((card) => String(card.cardId) !== String(cardId));
  if (next.length === before.length) throw new AppError('Card not found', 404, 'CARD_NOT_FOUND');
  if (next.length > 0 && !next.some((card) => card.isDefault)) next[0].isDefault = true;
  user.savedCards = next;
  await userRepository.saveUser(user);
  return listSavedCards(userId);
};

const setDefaultCard = async ({ userId, cardId }) => {
  const user = await userRepository.findByIdForAccountSecurity(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  const hasCard = (user.savedCards || []).some((card) => String(card.cardId) === String(cardId));
  if (!hasCard) throw new AppError('Card not found', 404, 'CARD_NOT_FOUND');
  user.savedCards = (user.savedCards || []).map((card) => ({
    ...card.toObject(),
    isDefault: String(card.cardId) === String(cardId)
  }));
  await userRepository.saveUser(user);
  return listSavedCards(userId);
};

const requestDataDownload = async (userId) => {
  const user = await userRepository.findByIdForAccountSecurity(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  user.privacySettings = {
    ...(user.privacySettings || {}),
    dataDownloadRequested: true
  };
  await userRepository.saveUser(user);
  await sendEmail({
    to: user.email,
    subject: 'Data download request received',
    text: `Hi ${user.name}, your data download request has been received and is being processed.`
  });
};

const requestProfileChangeOtp = async ({ userId, type, value }) => {
  const normalizedType = String(type || '').toLowerCase();
  const normalizedValue = normalizedType === 'email' ? String(value || '').toLowerCase() : String(value || '');
  const purpose = normalizedType === 'email' ? 'EMAIL_CHANGE' : normalizedType === 'phone' ? 'PHONE_CHANGE' : null;
  if (!purpose) throw new AppError('Invalid OTP type', 400, 'INVALID_OTP_TYPE');

  const otpRaw = generateNumericOtp(6);
  const otpHash = await bcrypt.hash(otpRaw, env.bcryptSaltRounds);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await profileOtpRepository.createOtp({
    userId,
    purpose,
    targetValue: normalizedValue,
    otpHash,
    expiresAt
  });

  if (purpose === 'EMAIL_CHANGE') {
    const result = await sendEmail({
      to: normalizedValue,
      subject: 'Verify your email change',
      text: `Your OTP is ${otpRaw}. It expires in 10 minutes.`
    });
    if (!result.queued) throw new AppError('Failed to deliver OTP email', 500, 'OTP_DELIVERY_FAILED');
    return;
  }

  const result = await notificationService.sendSms({
    to: normalizedValue,
    message: `Your OTP is ${otpRaw}. It expires in 10 minutes.`
  });
  if (!result.queued) throw new AppError('Failed to deliver OTP SMS', 500, 'OTP_DELIVERY_FAILED');
};

const verifyProfileChangeOtp = async ({ userId, type, value, otp }) => {
  const normalizedType = String(type || '').toLowerCase();
  const normalizedValue = normalizedType === 'email' ? String(value || '').toLowerCase() : String(value || '');
  const purpose = normalizedType === 'email' ? 'EMAIL_CHANGE' : normalizedType === 'phone' ? 'PHONE_CHANGE' : null;
  if (!purpose) throw new AppError('Invalid OTP type', 400, 'INVALID_OTP_TYPE');

  const doc = await profileOtpRepository.findLatestActiveWithHash({
    userId,
    purpose,
    targetValue: normalizedValue
  });
  if (!doc) throw new AppError('OTP not found or expired', 400, 'OTP_INVALID');

  const isMatch = await bcrypt.compare(String(otp || ''), doc.otpHash);
  if (!isMatch) {
    doc.attempts += 1;
    if (doc.attempts >= 5) doc.expiresAt = new Date();
    await profileOtpRepository.save(doc);
    throw new AppError('Invalid OTP', 400, 'OTP_INVALID');
  }

  doc.verifiedAt = new Date();
  await profileOtpRepository.save(doc);
};

const changePassword = async ({ userId, currentPassword, newPassword }) => {
  const user = await userRepository.findByIdWithTokens(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
  user.passwordHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds);
  await user.save();
};

const logoutAllDevices = async (userId) => {
  const user = await userRepository.findByIdWithTokens(userId);
  if (!user) return;
  user.refreshTokens = [];
  await user.save();
};

const requestAccountDeletion = async (userId) => {
  const user = await userRepository.findByIdWithTokens(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  user.accountStatus = 'PENDING_DELETION';
  user.refreshTokens = [];
  user.privacySettings = {
    ...(user.privacySettings || {}),
    deleteAccountRequested: true,
    deleteRequestedAt: new Date()
  };
  await user.save();
};

const anonymizeDueAccounts = async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const users = await userRepository.listDueDeletionUsers(cutoff, 200);

  for (const user of users) {
    user.name = `Deleted User ${user._id.toString().slice(-6)}`;
    user.email = `deleted_${user._id}@anonymized.local`;
    user.phone = `000000${user._id.toString().slice(-4)}`;
    user.profileImage = '';
    user.addresses = [];
    user.savedCards = [];
    user.notificationPreferences = {
      emailOrders: false,
      emailPromotions: false,
      smsOrders: false,
      pushNotifications: false
    };
    user.refreshTokens = [];
    user.blockReason = '';
    user.accountStatus = 'DELETED';
    await userRepository.saveUser(user);
  }

  return users.length;
};

const addRecentlyViewed = async ({ userId, productId }) => {
  const doc = await recentlyViewedRepository.findByUserId(userId);
  if (!doc) {
    await recentlyViewedRepository.createDoc({ userId, productIds: [productId] });
    return;
  }
  doc.productIds = [productId, ...doc.productIds.filter((id) => String(id) !== String(productId))].slice(0, 20);
  await recentlyViewedRepository.save(doc);
};

const getRecentlyViewed = async (userId) => {
  const doc = await recentlyViewedRepository.findPopulatedByUserId(userId);
  return doc?.productIds || [];
};

module.exports = {
  getProfile,
  updateProfile,
  setNotificationPreferences,
  updateAddresses,
  setTwoFactor,
  listActiveSessions,
  listSavedCards,
  addSavedCard,
  removeSavedCard,
  setDefaultCard,
  requestDataDownload,
  requestProfileChangeOtp,
  verifyProfileChangeOtp,
  changePassword,
  logoutAllDevices,
  requestAccountDeletion,
  anonymizeDueAccounts,
  addRecentlyViewed,
  getRecentlyViewed
};
