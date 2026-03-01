const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    imageUrl: { type: String, required: true },
    ctaText: { type: String, default: '' },
    ctaLink: { type: String, default: '' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Banner', bannerSchema);
