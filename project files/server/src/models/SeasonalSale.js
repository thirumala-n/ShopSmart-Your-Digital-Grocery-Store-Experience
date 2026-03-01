const mongoose = require('mongoose');

const seasonalSaleSchema = new mongoose.Schema(
  {
    campaignName: { type: String, required: true },
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    discountPercent: { type: Number, required: true, min: 0, max: 90 },
    bannerImageUrl: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SeasonalSale', seasonalSaleSchema);
