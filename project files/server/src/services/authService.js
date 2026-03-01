const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { hashValue } = require('../utils/crypto');
const userRepository = require('../repositories/userRepository');
const { sendEmail } = require('./emailService');
const { ROLES } = require('../utils/constants');

const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: String(user._id),
      userId: String(user._id),
      role: String(user.role || '').trim(),
      email: user.email,
      name: user.name
    },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessTtl }
  );

const signRefreshToken = (user) =>
  jwt.sign(
    { sub: String(user._id), jti: randomUUID() },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshTtl }
  );

const sanitizeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: String(user.role || '').trim(),
  accountStatus: user.accountStatus
});

const resetFailedLogin = async (userDoc) => {
  userDoc.failedLoginAttempts = 0;
  userDoc.loginLockedUntil = null;
  userDoc.lastLogin = new Date();
  await userDoc.save();
};

const register = async ({ name, email, phone, password }) => {
  const existing = await userRepository.findByEmailWithSecrets(email);
  if (existing) {
    throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
  }
  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);
  const created = await userRepository.createUser({
    name,
    email: String(email).toLowerCase(),
    phone,
    passwordHash,
    role: ROLES.CUSTOMER
  });
  return sanitizeUser(created);
};

const login = async ({ email, password }) => {
  const user = await userRepository.findByEmailWithSecrets(email);
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  if (user.accountStatus !== 'ACTIVE') {
    throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
  }
  if (user.loginLockedUntil && new Date(user.loginLockedUntil) > new Date()) {
    throw new AppError('Account temporarily locked for 15 minutes', 423, 'ACCOUNT_LOCKED');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.loginLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await sendEmail({
        to: user.email,
        subject: 'Account temporarily locked',
        text: 'Your account was locked for 15 minutes after multiple failed login attempts.'
      });
    }
    await user.save();
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  await resetFailedLogin(user);
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshTokenHash = hashValue(refreshToken);
  user.refreshTokens = [...(user.refreshTokens || []), refreshTokenHash];
  await user.save();

  return {
    user: sanitizeUser(user),
    token: accessToken,
    accessToken,
    refreshToken
  };
};

const refresh = async (refreshToken) => {
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
  } catch (error) {
    throw new AppError('Invalid refresh token', 401, 'TOKEN_INVALID');
  }

  const userById = await userRepository.findByIdWithTokens(payload.sub);
  if (!userById || userById.accountStatus !== 'ACTIVE') {
    throw new AppError('Invalid refresh token', 401, 'TOKEN_INVALID');
  }

  const refreshTokenHash = hashValue(refreshToken);
  const index = (userById.refreshTokens || []).indexOf(refreshTokenHash);
  if (index === -1) {
    throw new AppError('Refresh token revoked', 401, 'TOKEN_REVOKED');
  }

  const newAccessToken = signAccessToken(userById);
  const newRefreshToken = signRefreshToken(userById);
  const newRefreshHash = hashValue(newRefreshToken);
  userById.refreshTokens.splice(index, 1, newRefreshHash);
  await userById.save();
  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

const logout = async (userId, refreshToken) => {
  const user = await userRepository.findByIdWithTokens(userId);
  if (!user) return;
  const hash = hashValue(refreshToken);
  user.refreshTokens = (user.refreshTokens || []).filter((tokenHash) => tokenHash !== hash);
  await user.save();
};

const logoutAll = async (userId) => {
  const user = await userRepository.findByIdWithTokens(userId);
  if (!user) return;
  user.refreshTokens = [];
  await user.save();
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll
};
