const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const User = require('../models/User');

const ALLOWED_ROLES = ['CUSTOMER', 'SELLER', 'ADMIN'];
const LEGACY_ROLE_MAP = {
  USER: 'CUSTOMER'
};
const OTP_EXPIRES_MS = 5 * 60 * 1000;
const RESET_TOKEN_EXPIRES_MS = 20 * 60 * 1000;
const DUMMY_BCRYPT_HASH = '$2b$10$6NrLjLQd5hd2EJMKGi99n.GRxuSxA9F5afH4IpBPNLxQf4h1MCNnC';
const otpStore = new Map();

const normalizeRole = (role) => {
  const normalizedRole = String(role || 'CUSTOMER').trim().toUpperCase();
  return LEGACY_ROLE_MAP[normalizedRole] || normalizedRole;
};

const normalizeEmail = (email) => String(email || '').toLowerCase().trim();
const normalizeName = (name) => String(name || '').trim();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
const isStrongPassword = (password) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/.test(String(password || ''));
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const generateResetToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const getJwtSecret = () => process.env.JWT_SECRET || process.env.JWT_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev_jwt_secret');

const safeEquals = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const createToken = (user) => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    const configError = new Error('Server configuration error');
    configError.statusCode = 500;
    throw configError;
  }
  return jwt.sign(
    { userId: user._id, role: user.role },
    jwtSecret,
    { expiresIn }
  );
};

const getMailCredentials = () => ({
  user: process.env.EMAIL_USER || process.env.GMAIL_USER,
  pass: process.env.EMAIL_PASS || process.env.GMAIL_PASS
});

const createTransporter = () => {
  const { user, pass } = getMailCredentials();
  if (!user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
};

const sendOtpEmail = async (toEmail, otp, name) => {
  const transporter = createTransporter();
  const { user } = getMailCredentials();
  if (!transporter || !user) {
    return;
  }
  await transporter.sendMail({
    from: user,
    to: toEmail,
    subject: 'Your Grocery App OTP Verification Code',
    text: `Hello ${name}, your OTP is ${otp}. It expires in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Email Verification</h2>
        <p>Hello ${name},</p>
        <p>Your OTP verification code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p>This code expires in <strong>5 minutes</strong>.</p>
      </div>
    `
  });
};

const sendResetEmail = async (toEmail, name, token) => {
  const transporter = createTransporter();
  const { user } = getMailCredentials();
  if (!transporter || !user) {
    return;
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:4200';
  const resetLink = `${clientUrl}/reset-password?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: user,
    to: toEmail,
    subject: 'Reset your Grocery App password',
    text: `Hello ${name}, reset your password using this link: ${resetLink}. This link expires in 20 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>Use the link below to reset your password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link expires in <strong>20 minutes</strong>.</p>
      </div>
    `
  });
};

const sendOTPInternal = async (req, res, next, successStatusCode) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid request', code: 'VALIDATION_ERROR' });
    }

    const normalizedName = normalizeName(req.body.name || req.body.fullName);
    const normalizedEmail = normalizeEmail(req.body.email);
    const normalizedPassword = String(req.body.password || '');
    const normalizedRole = normalizeRole(req.body.role);

    if (!normalizedName || !normalizedEmail || !normalizedPassword) {
      return res.status(400).json({ success: false, message: 'Invalid request', code: 'VALIDATION_ERROR' });
    }
    if (!isValidEmail(normalizedEmail) || !isStrongPassword(normalizedPassword)) {
      return res.status(400).json({ success: false, message: 'Invalid request', code: 'VALIDATION_ERROR' });
    }
    if (!ALLOWED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ success: false, message: 'Invalid request', code: 'VALIDATION_ERROR' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).select('_id').lean();
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered', code: 'DUPLICATE_EMAIL' });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + OTP_EXPIRES_MS);

    otpStore.set(normalizedEmail, {
      name: normalizedName,
      email: normalizedEmail,
      password: normalizedPassword,
      role: normalizedRole,
      otp,
      otpExpires
    });

    res.status(successStatusCode).json({
      success: true,
      message: 'OTP sent successfully',
      code: 'OTP_SENT'
    });

    sendOtpEmail(normalizedEmail, otp, normalizedName).catch(() => {});
    return undefined;
  } catch (error) {
    return next(error);
  }
};

const sendOTP = async (req, res, next) => sendOTPInternal(req, res, next, 200);
const register = async (req, res, next) => sendOTPInternal(req, res, next, 201);

const verifyOTP = async (req, res, next) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || '').trim();

    if (!normalizedEmail || !otp) {
      return res.status(400).json({ success: false, message: 'Invalid request', code: 'VALIDATION_ERROR' });
    }

    const registrationData = otpStore.get(normalizedEmail);
    if (!registrationData) {
      return res.status(404).json({ success: false, message: 'OTP session not found', code: 'OTP_SESSION_NOT_FOUND' });
    }
    if (new Date(registrationData.otpExpires).getTime() < Date.now()) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ success: false, message: 'OTP expired', code: 'OTP_EXPIRED' });
    }
    if (!safeEquals(registrationData.otp, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP', code: 'INVALID_OTP' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).select('_id').lean();
    if (existingUser) {
      otpStore.delete(normalizedEmail);
      return res.status(409).json({ success: false, message: 'Email already registered', code: 'DUPLICATE_EMAIL' });
    }

    const user = await User.create({
      name: registrationData.name,
      email: registrationData.email,
      password: registrationData.password,
      role: registrationData.role || 'CUSTOMER',
      isVerified: true
    });

    otpStore.delete(normalizedEmail);

    return res.status(201).json({
      success: true,
      message: 'Email verified and user created successfully',
      code: 'OTP_VERIFIED',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const role = req.body?.role;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Invalid request', code: 'VALIDATION_ERROR' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid request', code: 'VALIDATION_ERROR' });
    }

    let normalizedRole;
    if (typeof role === 'string' && role.trim()) {
      normalizedRole = normalizeRole(role);
      if (!ALLOWED_ROLES.includes(normalizedRole)) {
        return res.status(400).json({ success: false, message: 'Invalid request', code: 'VALIDATION_ERROR' });
      }
    }

    const user = await User.findOne({ email }).select('password name email role createdAt isVerified');
    if (!user) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      return res.status(401).json({ success: false, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }
    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Email is not verified', code: 'EMAIL_NOT_VERIFIED' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }
    if (normalizedRole && user.role !== normalizedRole) {
      return res.status(403).json({ success: false, message: 'Forbidden', code: 'ROLE_MISMATCH' });
    }

    const token = createToken(user);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    const authError = new Error('Internal Server Error');
    authError.statusCode = 500;
    authError.code = 'LOGIN_ERROR';
    return next(authError);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email' });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('_id name email');
    const genericResponse = {
      success: true,
      message: 'If an account exists, password reset instructions have been sent.'
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const rawToken = generateResetToken();
    user.resetPasswordToken = hashToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS);
    await user.save();

    res.status(200).json(genericResponse);
    sendResetEmail(user.email, user.name || 'User', rawToken).catch(() => {});
    return undefined;
  } catch (error) {
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim();
    const legacyEmail = normalizeEmail(req.body?.email);
    const legacyOtp = String(req.body?.otp || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!newPassword || !isStrongPassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'Invalid request data' });
    }

    if (token) {
      const hashed = hashToken(token);
      const user = await User.findOne({
        resetPasswordToken: hashed
      }).select('+resetPasswordToken +resetPasswordExpires +password');

      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid token' });
      }
      if (!user.resetPasswordExpires || user.resetPasswordExpires.getTime() < Date.now()) {
        return res.status(410).json({ success: false, message: 'Token expired' });
      }

      user.password = newPassword;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      return res.status(200).json({ success: true, message: 'Password reset successful' });
    }

    if (!legacyEmail || !legacyOtp) {
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }

    const stored = otpStore.get(`reset_${legacyEmail}`);
    if (!stored) {
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }
    if (new Date(stored.otpExpires).getTime() < Date.now()) {
      otpStore.delete(`reset_${legacyEmail}`);
      return res.status(410).json({ success: false, message: 'Token expired' });
    }
    if (!safeEquals(stored.otp, legacyOtp)) {
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }

    const user = await User.findOne({ email: legacyEmail }).select('+password');
    if (!user) {
      otpStore.delete(`reset_${legacyEmail}`);
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    otpStore.delete(`reset_${legacyEmail}`);

    return res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  sendOTP,
  verifyOTP,
  forgotPassword,
  resetPassword
};
