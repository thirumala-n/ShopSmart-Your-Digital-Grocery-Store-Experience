const AppError = require('../utils/AppError');
const cartRepository = require('../repositories/cartRepository');
const productRepository = require('../repositories/productRepository');
const pricingService = require('./pricingService');

const mapVariant = (product, variantId) =>
  (product.variants || []).find((variant) => String(variant.variantId) === String(variantId));

const recalculateCart = async ({ userId, couponCode = '' }) => {
  const cart = await cartRepository.getOrCreateCart(userId);

  const lines = [];
  const categoryIds = [];
  const uniqueProductIds = Array.from(new Set((cart.items || []).map((row) => String(row.productId))));
  const products = await productRepository.findProductsByIds(uniqueProductIds, {
    name: 1,
    slug: 1,
    categoryId: 1,
    images: 1,
    isActive: 1,
    adminApproved: 1,
    variants: 1
  });
  const productMap = new Map(products.map((row) => [String(row._id), row]));

  for (const item of cart.items) {
    const product = productMap.get(String(item.productId));
    if (!product || !product.isActive || !product.adminApproved) {
      continue;
    }
    const variant = mapVariant(product, item.variantId);
    if (!variant) {
      continue;
    }
    const qty = Math.min(item.quantity, Math.max(0, variant.stock));
    if (qty <= 0) {
      continue;
    }
    const linePrice = qty * variant.price;
    categoryIds.push(product.categoryId);
    lines.push({
      productId: product._id,
      variantId: variant.variantId,
      productName: product.name,
      variantLabel: variant.weight,
      quantity: qty,
      unitPrice: variant.price,
      unitMRP: variant.MRP,
      lineTotal: Number(linePrice.toFixed(2)),
      stock: variant.stock,
      image: product.images?.[0] || ''
    });
  }

  const pricing = await pricingService.calculatePricingSummary({
    lines,
    userId,
    couponCode: couponCode || cart.couponCode,
    categoryIds
  });

  return {
    lines,
    summary: {
      totalMRP: pricing.totalMRP,
      totalDiscount: pricing.totalDiscount,
      couponCode: pricing.couponResult.valid ? (couponCode || cart.couponCode || '').toUpperCase() : '',
      couponDiscount: pricing.couponDiscount,
      deliveryFee: pricing.deliveryFee,
      tax: pricing.tax,
      grandTotal: pricing.grandTotal
    }
  };
};

const addItem = async ({ userId, productId, variantId, quantity }) => {
  const cart = await cartRepository.getOrCreateCart(userId);
  const existing = cart.items.find(
    (item) => String(item.productId) === String(productId) && String(item.variantId) === String(variantId)
  );
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ productId, variantId, quantity });
  }
  await cartRepository.saveCart(cart);
  return recalculateCart({ userId });
};

const updateQty = async ({ userId, productId, variantId, quantity }) => {
  if (quantity < 1) throw new AppError('Quantity must be at least 1', 400, 'INVALID_QUANTITY');
  const cart = await cartRepository.getOrCreateCart(userId);
  const item = cart.items.find(
    (line) => String(line.productId) === String(productId) && String(line.variantId) === String(variantId)
  );
  if (!item) throw new AppError('Item not found in cart', 404, 'CART_ITEM_NOT_FOUND');
  item.quantity = quantity;
  await cartRepository.saveCart(cart);
  return recalculateCart({ userId });
};

const removeItem = async ({ userId, productId, variantId }) => {
  const cart = await cartRepository.getOrCreateCart(userId);
  cart.items = cart.items.filter(
    (line) => !(String(line.productId) === String(productId) && String(line.variantId) === String(variantId))
  );
  await cartRepository.saveCart(cart);
  return recalculateCart({ userId });
};

const applyCoupon = async ({ userId, code }) => {
  const cart = await cartRepository.getOrCreateCart(userId);
  const normalizedCode = String(code || '').trim().toUpperCase();
  cart.couponCode = normalizedCode;
  await cartRepository.saveCart(cart);
  const recalculated = await recalculateCart({ userId, couponCode: cart.couponCode });
  if (recalculated.summary.couponCode !== normalizedCode) {
    cart.couponCode = '';
    await cartRepository.saveCart(cart);
    throw new AppError('Invalid coupon code', 400, 'COUPON_INVALID');
  }
  return recalculated;
};

const clearCoupon = async ({ userId }) => {
  const cart = await cartRepository.getOrCreateCart(userId);
  cart.couponCode = '';
  await cartRepository.saveCart(cart);
  return recalculateCart({ userId });
};

const getCart = ({ userId }) => recalculateCart({ userId });

module.exports = {
  recalculateCart,
  addItem,
  updateQty,
  removeItem,
  applyCoupon,
  clearCoupon,
  getCart
};
