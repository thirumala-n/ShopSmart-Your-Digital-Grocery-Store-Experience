const mongoose = require('mongoose');

const homeFeaturedItemSchema = new mongoose.Schema(
  {
    section: { type: String, enum: ['deals', 'trending'], required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    imageUrl: { type: String, default: '' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { _id: false }
);

const homeFeaturedConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'HOME_FEATURED', unique: true, index: true },
    items: { type: [homeFeaturedItemSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('HomeFeaturedConfig', homeFeaturedConfigSchema);

