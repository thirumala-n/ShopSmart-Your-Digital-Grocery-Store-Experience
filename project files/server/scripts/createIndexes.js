/* eslint-disable no-console */
const { connectDB, mongoose } = require('../src/config/db');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Order = require('../src/models/Order');
const User = require('../src/models/User');
const Coupon = require('../src/models/Coupon');
const Newsletter = require('../src/models/Newsletter');
const Wishlist = require('../src/models/Wishlist');
const Brand = require('../src/models/Brand');
const Banner = require('../src/models/Banner');
const DeliverySlot = require('../src/models/DeliverySlot');
const StockMovement = require('../src/models/StockMovement');
const SupportTicket = require('../src/models/SupportTicket');
const RecentlyViewed = require('../src/models/RecentlyViewed');
const Cart = require('../src/models/Cart');
const PolicyContent = require('../src/models/PolicyContent');
const BundleOffer = require('../src/models/BundleOffer');
const SeasonalSale = require('../src/models/SeasonalSale');
const PaymentTransaction = require('../src/models/PaymentTransaction');
const ParentOrder = require('../src/models/ParentOrder');
const ImportJob = require('../src/models/ImportJob');
const ProfileOtp = require('../src/models/ProfileOtp');
const StockAlertSubscription = require('../src/models/StockAlertSubscription');
const ProcessedWebhookEvent = require('../src/models/ProcessedWebhookEvent');
const AuditLog = require('../src/models/AuditLog');

const run = async () => {
  await connectDB();
  await Promise.all([
    Product.syncIndexes(),
    Category.syncIndexes(),
    Order.syncIndexes(),
    User.syncIndexes(),
    Coupon.syncIndexes(),
    Newsletter.syncIndexes(),
    Wishlist.syncIndexes(),
    Brand.syncIndexes(),
    Banner.syncIndexes(),
    DeliverySlot.syncIndexes(),
    StockMovement.syncIndexes(),
    SupportTicket.syncIndexes(),
    RecentlyViewed.syncIndexes(),
    Cart.syncIndexes(),
    PolicyContent.syncIndexes(),
    BundleOffer.syncIndexes(),
    SeasonalSale.syncIndexes(),
    PaymentTransaction.syncIndexes(),
    ParentOrder.syncIndexes(),
    ImportJob.syncIndexes(),
    ProfileOtp.syncIndexes(),
    StockAlertSubscription.syncIndexes(),
    ProcessedWebhookEvent.syncIndexes(),
    AuditLog.syncIndexes()
  ]);
  console.log('Indexes synced successfully');
  await mongoose.connection.close();
};

run().catch(async (error) => {
  console.error('Index sync failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
