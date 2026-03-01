const mongoose = require('mongoose');

const productReviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  brand: { type: String, default: 'Generic', trim: true },
  discountPercentage: { type: Number, min: 0, max: 90, default: 0 },
  tags: [{ type: String, trim: true }],
  images: [{ type: String, trim: true }],
  image: { type: String, default: '' },
  ratingAverage: { type: Number, min: 0, max: 5, default: 0 },
  ratingCount: { type: Number, min: 0, default: 0 },
  soldCount: { type: Number, min: 0, default: 0 },
  viewsCount: { type: Number, min: 0, default: 0 },
  reviews: [productReviewSchema],
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ sellerId: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ sellerId: 1, category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ ratingAverage: -1 });
productSchema.index({ soldCount: -1 });

module.exports = mongoose.model('Product', productSchema);
