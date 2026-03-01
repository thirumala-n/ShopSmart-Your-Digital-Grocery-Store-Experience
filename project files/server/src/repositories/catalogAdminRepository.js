const Product = require('../models/Product');
const Category = require('../models/Category');
const Coupon = require('../models/Coupon');
const Banner = require('../models/Banner');
const BundleOffer = require('../models/BundleOffer');
const SeasonalSale = require('../models/SeasonalSale');
const PolicyContent = require('../models/PolicyContent');
const brandRepository = require('./brandRepository');
const bannerRepository = require('./bannerRepository');

const upsertProduct = async (payload) =>
  payload.id ? Product.findByIdAndUpdate(payload.id, payload, { returnDocument: 'after' }).lean() : Product.create(payload);

const deleteProductById = (id) => Product.findByIdAndDelete(id).lean();

const categoryHasProducts = (id) => Product.exists({ $or: [{ categoryId: id }, { subCategoryId: id }] });

const upsertCategory = (payload) =>
  payload.id ? Category.findByIdAndUpdate(payload.id, payload, { returnDocument: 'after' }).lean() : Category.create(payload);

const deleteCategoryById = (id) => Category.findByIdAndDelete(id);

const upsertCoupon = (payload) =>
  payload.id ? Coupon.findByIdAndUpdate(payload.id, payload, { returnDocument: 'after' }).lean() : Coupon.create(payload);

const upsertBanner = (payload) =>
  payload.id ? Banner.findByIdAndUpdate(payload.id, payload, { returnDocument: 'after' }).lean() : Banner.create(payload);

const upsertBrand = (payload) => brandRepository.upsertById(payload);

const upsertBundleOffer = (payload) =>
  payload.id ? BundleOffer.findByIdAndUpdate(payload.id, payload, { returnDocument: 'after' }).lean() : BundleOffer.create(payload);

const upsertSeasonalSale = (payload) =>
  payload.id ? SeasonalSale.findByIdAndUpdate(payload.id, payload, { returnDocument: 'after' }).lean() : SeasonalSale.create(payload);

const upsertPolicyContent = (payload) =>
  PolicyContent.findOneAndUpdate(
    { key: payload.key },
    { title: payload.title, contentHtml: payload.contentHtml, updatedBy: payload.updatedBy },
    { returnDocument: 'after', upsert: true }
  ).lean();

const listPendingSellerProducts = async ({ page, pageSize, skip }) => {
  const query = { adminApproved: false };
  const [items, total] = await Promise.all([
    Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .select('_id name slug SKU brand sellerId isActive adminApproved createdAt')
      .lean(),
    Product.countDocuments(query)
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
};

const getProductById = (id) => Product.findById(id);
const getProductByIdForUpdate = (id, session = null) => Product.findById(id, null, { session });

const saveProduct = (doc) => doc.save();

const setLowStockThreshold = (productId, threshold) =>
  Product.findByIdAndUpdate(productId, { lowStockThreshold: threshold }, { returnDocument: 'after' }).lean();

const listAllBanners = () => bannerRepository.listAllBanners();

const reorderBanners = (bannerIds) => bannerRepository.reorderBanners(bannerIds);

module.exports = {
  upsertProduct,
  deleteProductById,
  categoryHasProducts,
  upsertCategory,
  deleteCategoryById,
  upsertCoupon,
  upsertBanner,
  upsertBrand,
  upsertBundleOffer,
  upsertSeasonalSale,
  upsertPolicyContent,
  listPendingSellerProducts,
  getProductById,
  getProductByIdForUpdate,
  saveProduct,
  setLowStockThreshold,
  listAllBanners,
  reorderBanners
};
