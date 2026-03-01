const ParentOrder = require('../models/ParentOrder');

const createParentOrder = async (payload, session = null) => {
  const [doc] = await ParentOrder.create([payload], { session });
  return doc;
};

const findByOrderGroupId = (orderGroupId, projection = null, session = null) =>
  ParentOrder.findOne({ orderGroupId }, projection || undefined, { session });

const listByUser = async ({ userId, page, pageSize, skip, activeOnly }) => {
  const query = { userId };
  if (activeOnly) {
    query.aggregateOrderStatus = {
      $nin: ['DELIVERED', 'CANCELLED', 'PARTIALLY_CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']
    };
  } else {
    query.aggregateOrderStatus = {
      $in: ['DELIVERED', 'CANCELLED', 'PARTIALLY_CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'PARTIALLY_DELIVERED']
    };
  }
  const [items, total] = await Promise.all([
    ParentOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    ParentOrder.countDocuments(query)
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
};

const save = (doc, session = null) => doc.save({ session });

module.exports = {
  createParentOrder,
  findByOrderGroupId,
  listByUser,
  save
};
