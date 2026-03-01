const mongoose = require('mongoose');

const recentlyViewedSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

module.exports = mongoose.model('RecentlyViewed', recentlyViewedSchema);
