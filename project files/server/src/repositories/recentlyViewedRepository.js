const RecentlyViewed = require('../models/RecentlyViewed');

const findByUserId = (userId, session = null) =>
  RecentlyViewed.findOne({ userId }, null, { session });

const createDoc = (payload, session = null) => RecentlyViewed.create([payload], { session }).then((rows) => rows[0]);

const save = (doc, session = null) => doc.save({ session });

const findPopulatedByUserId = (userId) =>
  RecentlyViewed.findOne({ userId }).populate({
    path: 'productIds',
    select: 'name slug brand images variants rating totalReviews'
  });

module.exports = {
  findByUserId,
  createDoc,
  save,
  findPopulatedByUserId
};
