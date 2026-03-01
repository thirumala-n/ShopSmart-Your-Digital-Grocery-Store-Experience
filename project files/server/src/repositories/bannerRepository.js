const Banner = require('../models/Banner');

const listActiveBanners = (date = new Date()) =>
  Banner.find({
    isActive: true,
    validFrom: { $lte: date },
    validTo: { $gte: date }
  })
    .sort({ displayOrder: 1 })
    .limit(5)
    .lean();

const listAllBanners = () => Banner.find({}).sort({ displayOrder: 1, createdAt: -1 }).lean();

const listAllBannersPaged = async ({ page, pageSize, skip }) => {
  const [items, total] = await Promise.all([
    Banner.find({})
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Banner.countDocuments({})
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
};

const reorderBanners = async (bannerIds = []) => {
  const operations = bannerIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { displayOrder: index + 1 } }
    }
  }));
  if (operations.length) {
    await Banner.bulkWrite(operations);
  }
  return listAllBanners();
};

module.exports = { listActiveBanners, listAllBanners, listAllBannersPaged, reorderBanners };
