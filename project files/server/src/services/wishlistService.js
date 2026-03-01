const productRepository = require('../repositories/productRepository');
const wishlistRepository = require('../repositories/wishlistRepository');
const stockAlertSubscriptionRepository = require('../repositories/stockAlertSubscriptionRepository');
const AppError = require('../utils/AppError');

const listWishlist = async (userId) => {
  const wishlist = await wishlistRepository.getOrCreateWishlist(userId);
  if (!wishlist.productIds.length) {
    return [];
  }
  const products = await Promise.all(
    wishlist.productIds.map((productId) =>
      productRepository.findProductById(productId, {
        name: 1,
        slug: 1,
        brand: 1,
        images: 1,
        variants: 1
      })
    )
  );
  return products.filter(Boolean);
};

const addWishlistItem = async ({ userId, productId }) => {
  const wishlist = await wishlistRepository.getOrCreateWishlist(userId);
  if (!wishlist.productIds.some((id) => String(id) === String(productId))) {
    wishlist.productIds.push(productId);
    await wishlistRepository.saveWishlist(wishlist);
  }
  return listWishlist(userId);
};

const removeWishlistItem = async ({ userId, productId }) => {
  const wishlist = await wishlistRepository.getOrCreateWishlist(userId);
  wishlist.productIds = wishlist.productIds.filter((id) => String(id) !== String(productId));
  await wishlistRepository.saveWishlist(wishlist);
  return listWishlist(userId);
};

const subscribeStockAlert = async ({ userId, productId }) => {
  const product = await productRepository.findProductById(productId, { _id: 1, variants: 1 });
  if (!product) throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
  const inStock = (product.variants || []).some((variant) => Number(variant.stock || 0) > 0);
  if (inStock) {
    throw new AppError('Product is already in stock', 400, 'PRODUCT_ALREADY_IN_STOCK');
  }
  await stockAlertSubscriptionRepository.upsertActive({ userId, productId });
  return { message: 'You will be notified when this product is back in stock' };
};

module.exports = {
  listWishlist,
  addWishlistItem,
  removeWishlistItem,
  subscribeStockAlert
};
