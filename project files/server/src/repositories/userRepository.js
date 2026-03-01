const User = require('../models/User');

const publicProjection =
  '_id name email phone role profileImage addresses savedCards notificationPreferences twoFactorEnabled privacySettings accountStatus blockReason lastLogin createdAt updatedAt';

const findByEmailWithSecrets = (email) =>
  User.findOne({ email: String(email || '').toLowerCase() }).select(
    '+passwordHash +refreshTokens name email phone role accountStatus failedLoginAttempts loginLockedUntil'
  );

const findById = (id) => User.findById(id).select(publicProjection).lean();

const findByIdWithTokens = (id) =>
  User.findById(id).select('+refreshTokens +passwordHash name email phone role accountStatus failedLoginAttempts loginLockedUntil');

const findActiveAuthById = (id) =>
  User.findById(id)
    .select('_id name email role accountStatus')
    .lean();

const findByIdForAccountSecurity = (id) =>
  User.findById(id).select(
    '+refreshTokens +savedCards.gatewayToken name email phone role accountStatus failedLoginAttempts loginLockedUntil twoFactorEnabled privacySettings lastLogin savedCards.cardId savedCards.last4 savedCards.brand savedCards.expiryMonth savedCards.expiryYear savedCards.isDefault'
  );

const updateById = (id, updates, options = {}) =>
  User.findByIdAndUpdate(id, updates, { returnDocument: 'after', ...options }).select(publicProjection).lean();

const createUser = (payload) => User.create(payload);

const listUsers = async ({ query, page, pageSize, skip }) => {
  const [items, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .select('_id name email phone role accountStatus createdAt')
      .lean(),
    User.countDocuments(query)
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
};

const setBlockState = (id, { block, reason = '' }) =>
  User.findByIdAndUpdate(id, {
    accountStatus: block ? 'BLOCKED' : 'ACTIVE',
    blockReason: block ? reason : '',
    refreshTokens: []
  });

const countActiveUsers = () => User.countDocuments({ accountStatus: 'ACTIVE' });

const listDueDeletionUsers = (cutoff, limit = 200) =>
  User.find({
    accountStatus: 'PENDING_DELETION',
    'privacySettings.deleteRequestedAt': { $lte: cutoff }
  })
    .select('+refreshTokens +passwordHash')
    .limit(limit);

const saveUser = (doc) => doc.save();

module.exports = {
  findByEmailWithSecrets,
  findById,
  findByIdWithTokens,
  findActiveAuthById,
  findByIdForAccountSecurity,
  updateById,
  createUser,
  listUsers,
  setBlockState,
  countActiveUsers,
  listDueDeletionUsers,
  saveUser
};
