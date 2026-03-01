const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');

const listSellerProducts = (sellerId, pageSize, skip) =>
  Product.find({ sellerId }).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).lean();

const countSellerProducts = (sellerId) => Product.countDocuments({ sellerId });

const findSellerProductById = ({ sellerId, productId }) => Product.findOne({ _id: productId, sellerId });

const createSellerProduct = (payload) => Product.create(payload);

const findSellerProductByIdForUpdate = ({ sellerId, productId, session = null }) =>
  Product.findOne({ _id: productId, sellerId }, null, { session });

const saveProduct = (doc, session = null) => doc.save({ session });

const createStockMovement = (payload, session = null) =>
  StockMovement.create([payload], { session }).then((rows) => rows[0]);

const listSellerLowStockVariants = async ({ sellerId }) => {
  const products = await Product.find({ sellerId }, { name: 1, variants: 1, lowStockThreshold: 1 }).lean();
  const rows = [];
  products.forEach((product) => {
    const threshold = Number(product.lowStockThreshold || 10);
    (product.variants || []).forEach((variant) => {
      if (Number(variant.stock || 0) < threshold) {
        rows.push({
          productId: product._id,
          productName: product.name,
          variantId: variant.variantId,
          variantLabel: variant.weight,
          stock: variant.stock,
          threshold
        });
      }
    });
  });
  return rows;
};

module.exports = {
  listSellerProducts,
  countSellerProducts,
  findSellerProductById,
  createSellerProduct,
  findSellerProductByIdForUpdate,
  saveProduct,
  createStockMovement,
  listSellerLowStockVariants
};
