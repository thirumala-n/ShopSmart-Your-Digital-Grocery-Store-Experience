const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const env = require('../config/env');

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || env.corsWhitelist.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
});

const loginRateLimit = env.isProd
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please try again in 15 minutes.'
      }
    })
  : (_req, _res, next) => next();

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

const mongoSanitizeMiddleware = (req, _res, next) => {
  try {
    if (req.body && typeof req.body === 'object') {
      mongoSanitize.sanitize(req.body);
    }
    if (req.params && typeof req.params === 'object') {
      mongoSanitize.sanitize(req.params);
    }
    if (req.query && typeof req.query === 'object') {
      mongoSanitize.sanitize(req.query);
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  corsMiddleware,
  helmetMiddleware: helmet(),
  mongoSanitizeMiddleware,
  loginRateLimit,
  apiRateLimit
};
