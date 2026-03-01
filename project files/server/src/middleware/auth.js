const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
  }

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    const authUserId = payload.userId || payload.sub;
    const user = await userRepository.findActiveAuthById(authUserId);
    if (!user || user.accountStatus !== 'ACTIVE') {
      return next(new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE'));
    }
    req.auth = {
      userId: String(user._id),
      role: String(user.role || '').trim(),
      email: user.email,
      name: user.name
    };
    return next();
  } catch (error) {
    return next(new AppError('Invalid or expired token', 401, 'TOKEN_INVALID'));
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  const requiredRoles = roles.map((role) => String(role || '').trim()).filter(Boolean);
  const currentRole = String(req.auth?.role || '').trim();
  if (!currentRole || !requiredRoles.includes(currentRole)) {
    return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
  }
  return next();
};

module.exports = { authenticate, authorizeRoles };
