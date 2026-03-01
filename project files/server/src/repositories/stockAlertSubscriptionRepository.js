const StockAlertSubscription = require('../models/StockAlertSubscription');

const upsertActive = async ({ userId, productId }) => {
  const now = new Date();
  await StockAlertSubscription.findOneAndUpdate(
    { userId, productId },
    { $set: { isActive: true, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true, returnDocument: 'after' }
  );
};

module.exports = {
  upsertActive
};
