const HomeFeaturedConfig = require('../models/HomeFeaturedConfig');

const CONFIG_KEY = 'HOME_FEATURED';

const getConfig = async () => {
  const doc = await HomeFeaturedConfig.findOne({ key: CONFIG_KEY }).lean();
  return {
    key: CONFIG_KEY,
    items: (doc?.items || [])
      .filter((item) => item && item.productId)
      .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
  };
};

const upsertConfig = async (items) => {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => ({
      section: item.section,
      productId: item.productId,
      imageUrl: String(item.imageUrl || '').trim(),
      displayOrder: Number(item.displayOrder || 0),
      isActive: item.isActive !== false
    }))
    .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));

  const doc = await HomeFeaturedConfig.findOneAndUpdate(
    { key: CONFIG_KEY },
    { $set: { key: CONFIG_KEY, items: normalized } },
    { returnDocument: 'after', upsert: true }
  ).lean();

  return {
    key: CONFIG_KEY,
    items: doc?.items || []
  };
};

module.exports = {
  getConfig,
  upsertConfig
};

