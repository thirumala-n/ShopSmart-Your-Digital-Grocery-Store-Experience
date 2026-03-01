const Wishlist = require('../models/Wishlist');

const getOrCreateWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ userId });
  if (!wishlist) {
    wishlist = await Wishlist.create({ userId, productIds: [] });
  }
  return wishlist;
};

const saveWishlist = (wishlistDoc) => wishlistDoc.save();

module.exports = { getOrCreateWishlist, saveWishlist };
