const Cart = require('../models/Cart');

const getOrCreateCart = async (userId, session = null) => {
  const query = Cart.findOne({ userId });
  if (session) query.session(session);
  let cart = await query;
  if (!cart) {
    if (session) {
      const created = await Cart.create([{ userId, items: [], couponCode: '' }], { session });
      cart = created[0];
    } else {
      cart = await Cart.create({ userId, items: [], couponCode: '' });
    }
  }
  return cart;
};

const saveCart = (cart, session = null) => cart.save({ session });

const mergeItems = async ({ userId, items = [], couponCode = '', session = null }) => {
  const cart = await getOrCreateCart(userId, session);
  for (const row of items) {
    const quantity = Number(row.quantity || 0);
    if (quantity <= 0) continue;
    const existing = cart.items.find(
      (item) => String(item.productId) === String(row.productId) && String(item.variantId) === String(row.variantId)
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({
        productId: row.productId,
        variantId: row.variantId,
        quantity
      });
    }
  }
  if (couponCode && !cart.couponCode) {
    cart.couponCode = String(couponCode).trim().toUpperCase();
  }
  await saveCart(cart, session);
  return cart;
};

module.exports = { getOrCreateCart, saveCart, mergeItems };
