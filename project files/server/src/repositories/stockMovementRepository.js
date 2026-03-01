const StockMovement = require('../models/StockMovement');

const createMovement = (payload, session = null) =>
  StockMovement.create([payload], { session }).then((rows) => rows[0]);

const listMovements = async ({ query = {}, page = 1, pageSize = 20, skip = 0 }) => {
  const [items, total] = await Promise.all([
    StockMovement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('productId', 'name SKU')
      .populate('performedBy', 'name email')
      .populate('referenceOrderId', 'orderId')
      .lean(),
    StockMovement.countDocuments(query)
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
};

const listMovementsBySeller = async ({ sellerId, page = 1, pageSize = 20, skip = 0 }) => {
  const pipeline = [
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    { $match: { 'product.sellerId': sellerId } },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: pageSize },
          {
            $project: {
              _id: 1,
              productId: 1,
              variantId: 1,
              delta: 1,
              reason: 1,
              referenceOrderId: 1,
              performedBy: 1,
              createdAt: 1,
              productName: '$product.name',
              productSKU: '$product.SKU'
            }
          }
        ],
        total: [{ $count: 'count' }]
      }
    }
  ];
  const [result] = await StockMovement.aggregate(pipeline);
  const total = result?.total?.[0]?.count || 0;
  return {
    items: result?.items || [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1
  };
};

module.exports = {
  createMovement,
  listMovements,
  listMovementsBySeller
};
