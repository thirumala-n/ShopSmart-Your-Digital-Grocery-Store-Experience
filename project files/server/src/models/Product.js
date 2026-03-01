const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    variantId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    weight: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    MRP: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    skuSuffix: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true, trim: true },
    SKU: { type: String, required: true, unique: true, trim: true },
    brand: { type: String, required: true, index: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    variants: { type: [variantSchema], validate: [(arr) => arr.length > 0, 'At least one variant is required'] },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0, min: 0 },
    salesCount: { type: Number, default: 0, min: 0, index: true },
    images: [{ type: String, trim: true }],
    description: { type: String, default: '' },
    tags: [{ type: String, trim: true }],
    isFeatured: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    adminApproved: { type: Boolean, default: false },
    adminReviewNote: { type: String, default: '' },
    lowStockThreshold: { type: Number, default: 10, min: 0 }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.virtual('discountPercent').get(function discountPercent() {
  let maxDiscount = 0;
  for (const variant of this.variants || []) {
    if (variant.MRP > 0 && variant.MRP >= variant.price) {
      const pct = Math.round(((variant.MRP - variant.price) / variant.MRP) * 100);
      if (pct > maxDiscount) {
        maxDiscount = pct;
      }
    }
  }
  return maxDiscount;
});

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ categoryId: 1 });
productSchema.index({ subCategoryId: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ salesCount: 1 });
productSchema.index({ sellerId: 1 });

module.exports = mongoose.model('Product', productSchema);
