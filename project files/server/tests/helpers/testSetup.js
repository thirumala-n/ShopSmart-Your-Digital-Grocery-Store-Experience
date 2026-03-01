const path = require('path');
const bcrypt = require('bcryptjs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const supertest = require('supertest');

const bootEnv = () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-1234567890';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-1234567890';
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.JWT_REFRESH_TTL = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '12';
  process.env.PAYMENT_PROVIDER = 'MOCK';
  process.env.CORS_WHITELIST = 'http://localhost:4200';
  process.env.MONGO_POOL_MAX = '10';
  process.env.MONGO_POOL_MIN = '1';
  process.chdir(path.resolve(__dirname, '..', '..', '..'));
};

const installNotificationOtpSpy = () => {
  const notificationService = require('../../src/services/notificationService');
  let lastOtp = '';
  notificationService.sendOtpNotification = async ({ otp }) => {
    lastOtp = String(otp);
  };
  return {
    readLastOtp: () => lastOtp
  };
};

const createHarness = async () => {
  bootEnv();
  const replset = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  process.env.MONGO_URI = replset.getUri('grocery_webapp_test');

  const { connectDB, mongoose } = require('../../src/config/db');
  await connectDB();

  const security = require('../../src/middleware/security');
  security.mongoSanitizeMiddleware = (req, res, next) => next();
  security.loginRateLimit = (req, res, next) => next();

  const otpSpy = installNotificationOtpSpy();
  const app = require('../../src/app');

  const User = require('../../src/models/User');
  const Category = require('../../src/models/Category');
  const Product = require('../../src/models/Product');
  const Cart = require('../../src/models/Cart');
  const DeliverySlot = require('../../src/models/DeliverySlot');
  const Order = require('../../src/models/Order');
  const ParentOrder = require('../../src/models/ParentOrder');
  const PaymentTransaction = require('../../src/models/PaymentTransaction');

  const request = supertest(app);

  const mkUser = async ({ name, email, phone, role = 'USER', password = 'Password!1' }) => {
    const passwordHash = await bcrypt.hash(password, 12);
    return User.create({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      role,
      accountStatus: 'ACTIVE'
    });
  };

  const login = async ({ email, password = 'Password!1' }) => {
    const res = await request.post('/api/auth/login').send({ email, password });
    return {
      accessToken: res.body?.data?.accessToken,
      refreshToken: res.body?.data?.refreshToken,
      response: res
    };
  };

  const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

  const seedCatalogForSellers = async ({ sellerAId, sellerBId }) => {
    const root = await Category.create({
      name: 'Root',
      slug: `root-${Date.now()}`,
      level: 0,
      isActive: true
    });
    const sub = await Category.create({
      name: 'Sub',
      slug: `sub-${Date.now()}`,
      level: 1,
      parentCategoryId: root._id,
      isActive: true
    });

    const productA = await Product.create({
      name: 'Seller A Product',
      slug: `seller-a-product-${Date.now()}`,
      SKU: `SKU-A-${Date.now()}`,
      brand: 'BrandA',
      categoryId: root._id,
      subCategoryId: sub._id,
      sellerId: sellerAId,
      isActive: true,
      adminApproved: true,
      variants: [
        { weight: '1kg', price: 100, MRP: 120, stock: 50, skuSuffix: '1KG' }
      ],
      images: ['https://example.com/a.jpg']
    });

    const productB = await Product.create({
      name: 'Seller B Product',
      slug: `seller-b-product-${Date.now()}`,
      SKU: `SKU-B-${Date.now()}`,
      brand: 'BrandB',
      categoryId: root._id,
      subCategoryId: sub._id,
      sellerId: sellerBId,
      isActive: true,
      adminApproved: true,
      variants: [
        { weight: '500g', price: 80, MRP: 100, stock: 50, skuSuffix: '500G' }
      ],
      images: ['https://example.com/b.jpg']
    });

    return { root, sub, productA, productB };
  };

  const seedDeliverySlot = async () =>
    DeliverySlot.create({
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      timeWindow: '9am-1pm',
      capacity: 50,
      booked: 0,
      isActive: true
    });

  const putCart = async ({ userId, items }) => {
    await Cart.findOneAndUpdate(
      { userId },
      { $set: { userId, items, couponCode: '' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  };

  const shutdown = async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await replset.stop();
  };

  return {
    request,
    models: { User, Category, Product, Cart, DeliverySlot, Order, ParentOrder, PaymentTransaction },
    helpers: {
      mkUser,
      login,
      authHeader,
      seedCatalogForSellers,
      seedDeliverySlot,
      putCart,
      readLastOtp: otpSpy.readLastOtp
    },
    shutdown
  };
};

module.exports = {
  createHarness
};
