const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const splitCsv = (value = '') =>
  String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || '',
  mongoPoolMax: Number(process.env.MONGO_POOL_MAX || 50),
  mongoPoolMin: Number(process.env.MONGO_POOL_MIN || 5),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || '',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  corsWhitelist: splitCsv(process.env.CORS_WHITELIST || process.env.CLIENT_URL || 'http://localhost:4200'),
  bcryptSaltRounds: Math.max(12, Number(process.env.BCRYPT_SALT_ROUNDS || 12)),
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  appName: process.env.APP_NAME || 'grocery-marketplace',
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:4200',
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
  defaultDeliveryFee: Number(process.env.DEFAULT_DELIVERY_FEE || 40),
  freeDeliveryThreshold: Number(process.env.FREE_DELIVERY_THRESHOLD || 499),
  taxPercent: Number(process.env.TAX_PERCENT || 5),
  lowStockDefaultThreshold: Number(process.env.LOW_STOCK_DEFAULT_THRESHOLD || 10)
};

const requiredKeys = ['mongoUri', 'jwtAccessSecret', 'jwtRefreshSecret'];
const missing = requiredKeys.filter((key) => !env[key]);
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

module.exports = env;
