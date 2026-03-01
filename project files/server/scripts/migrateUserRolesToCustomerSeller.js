/* eslint-disable no-console */
const { connectDB, mongoose } = require('../src/config/db');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');

const toObjectIdSet = (rows, field) =>
  new Set(
    rows
      .map((row) => row?.[field])
      .filter(Boolean)
      .map((id) => String(id))
  );

const run = async () => {
  await connectDB();

  const legacyUsers = await User.find({
    role: { $in: ['user', 'USER'] }
  })
    .select('_id email role')
    .lean();

  if (!legacyUsers.length) {
    console.log('No legacy user-role accounts found.');
    await mongoose.connection.close();
    return;
  }

  const [productSellers, orderSellers] = await Promise.all([
    Product.find({}, { sellerId: 1 }).lean(),
    Order.find({}, { sellerId: 1 }).lean()
  ]);

  const sellerIdSet = new Set([...toObjectIdSet(productSellers, 'sellerId'), ...toObjectIdSet(orderSellers, 'sellerId')]);
  const sellerEmailPattern = /\bseller\b/i;

  const sellerIds = [];
  const customerIds = [];

  legacyUsers.forEach((user) => {
    const id = String(user._id);
    const looksLikeSeller = sellerIdSet.has(id) || sellerEmailPattern.test(String(user.email || ''));
    if (looksLikeSeller) {
      sellerIds.push(user._id);
    } else {
      customerIds.push(user._id);
    }
  });

  let sellerResult = { modifiedCount: 0 };
  let customerResult = { modifiedCount: 0 };
  if (sellerIds.length) {
    sellerResult = await User.updateMany({ _id: { $in: sellerIds } }, { $set: { role: 'seller' } });
  }
  if (customerIds.length) {
    customerResult = await User.updateMany({ _id: { $in: customerIds } }, { $set: { role: 'customer' } });
  }

  console.log(
    `Role migration complete. sellers=${sellerResult.modifiedCount}, customers=${customerResult.modifiedCount}, total=${legacyUsers.length}`
  );

  await mongoose.connection.close();
};

run().catch(async (error) => {
  console.error('Role migration failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
