const Brand = require('../models/Brand');

const listFeaturedActive = ({ limit = 20 } = {}) =>
  Brand.find({ isActive: true, isFeatured: true }).sort({ name: 1 }).limit(limit).lean();

const upsertById = (payload) =>
  payload.id ? Brand.findByIdAndUpdate(payload.id, payload, { returnDocument: 'after' }).lean() : Brand.create(payload);

module.exports = {
  listFeaturedActive,
  upsertById
};
