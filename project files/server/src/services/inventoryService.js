const { mongoose } = require('../config/db');
const AppError = require('../utils/AppError');
const productRepository = require('../repositories/productRepository');
const stockMovementRepository = require('../repositories/stockMovementRepository');
const env = require('../config/env');

const decrementStockForOrderItems = async ({ items, performedBy, referenceOrderId, session }) => {
  const failures = [];
  for (const item of items) {
    const updated = await productRepository.decrementVariantStock({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      session
    });
    if (!updated) {
      failures.push({
        productId: item.productId,
        variantId: item.variantId,
        requestedQty: item.quantity
      });
      continue;
    }
    await stockMovementRepository.createMovement(
      {
        productId: item.productId,
        variantId: item.variantId,
        delta: -Math.abs(item.quantity),
        reason: 'ORDER_CONFIRMED',
        referenceOrderId,
        performedBy
      },
      session
    );
  }
  if (failures.length > 0) {
    throw new AppError('Insufficient stock for one or more items', 409, 'INSUFFICIENT_STOCK', failures);
  }
};

const restoreStockForOrderItems = async ({ items, performedBy, referenceOrderId, session }) => {
  for (const item of items) {
    await productRepository.incrementVariantStock({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      session
    });
    await stockMovementRepository.createMovement(
      {
        productId: item.productId,
        variantId: item.variantId,
        delta: Math.abs(item.quantity),
        reason: 'ORDER_CANCELLED',
        referenceOrderId,
        performedBy
      },
      session
    );
  }
};

const withTransaction = async (callback) => {
  let session;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } catch (error) {
    // Fallback for standalone MongoDB (no replica set) where transactions are not supported
    const msg = String(error?.message || '');
    if (msg.includes('Transaction numbers are only allowed') || msg.includes('Transactions are not supported')) {
      return callback(undefined);
    }
    throw error;
  } finally {
    if (session) await session.endSession();
  }
};

const scanLowStockVariants = async () => {
  const docs = await productRepository.findLowStockProducts(env.lowStockDefaultThreshold);
  const alerts = [];
  for (const product of docs) {
    const threshold = product.lowStockThreshold || env.lowStockDefaultThreshold;
    for (const variant of product.variants || []) {
      if (variant.stock < threshold) {
        alerts.push({
          productId: product._id,
          productName: product.name,
          variantId: variant.variantId,
          variantLabel: variant.weight,
          stock: variant.stock,
          threshold
        });
      }
    }
  }
  return alerts;
};

module.exports = {
  decrementStockForOrderItems,
  restoreStockForOrderItems,
  withTransaction,
  scanLowStockVariants
};
