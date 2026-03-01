const Product = require('../models/Product');

const buildProductFilters = (filters = {}) => {
  const query = { isActive: true, adminApproved: true };
  if (filters.categoryId) query.categoryId = filters.categoryId;
  if (filters.subCategoryId) query.subCategoryId = filters.subCategoryId;
  if (filters.brand) {
    const brands = String(filters.brand)
      .split(',')
      .map((row) => row.trim())
      .filter(Boolean);
    query.brand = brands.length > 1 ? { $in: brands } : brands[0];
  }
  if (typeof filters.isFeatured === 'boolean') query.isFeatured = filters.isFeatured;
  if (filters.sellerId) query.sellerId = filters.sellerId;
  if (filters.search) query.$text = { $search: filters.search };
  if (typeof filters.minRating === 'number') {
    query.rating = { ...(query.rating || {}), $gte: filters.minRating };
  }
  const variantFilter = {};
  if (typeof filters.minPrice === 'number') {
    variantFilter.price = { ...(variantFilter.price || {}), $gte: filters.minPrice };
  }
  if (typeof filters.maxPrice === 'number') {
    variantFilter.price = { ...(variantFilter.price || {}), $lte: filters.maxPrice };
  }
  if (filters.inStock) {
    variantFilter.stock = { $gt: 0 };
  }
  if (Object.keys(variantFilter).length > 0) {
    query.variants = { $elemMatch: variantFilter };
  }
  return query;
};

const computeDiscountPercent = (variants = []) => {
  let maxDiscount = 0;
  for (const variant of variants) {
    if (!variant || typeof variant.MRP !== 'number' || typeof variant.price !== 'number') continue;
    if (variant.MRP <= 0 || variant.price > variant.MRP) continue;
    const pct = Math.round(((variant.MRP - variant.price) / variant.MRP) * 100);
    if (pct > maxDiscount) maxDiscount = pct;
  }
  return maxDiscount;
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const dedupeProducts = (items = []) => {
  const byId = new Map();
  const byName = new Map();
  for (const item of items) {
    const idKey = String(item?._id || '').trim();
    const nameKey = String(item?.name || '').trim().toLowerCase();
    if (idKey) {
      byId.set(idKey, item);
      continue;
    }
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, item);
  }
  return [...byId.values(), ...byName.values()];
};

const buildSort = (sortBy = 'relevance', hasSearch = false) => {
  switch (sortBy) {
    case 'price_asc':
      return { 'variants.price': 1 };
    case 'price_desc':
      return { 'variants.price': -1 };
    case 'popularity':
      return { salesCount: -1 };
    case 'newest':
      return { createdAt: -1 };
    case 'discount_desc':
      return { salesCount: -1, rating: -1 };
    default:
      return hasSearch ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 };
  }
};

const listProducts = async ({ filters, page, pageSize, skip, sortBy }) => {
  const baseProjection = {
    name: 1,
    slug: 1,
    SKU: 1,
    brand: 1,
    categoryId: 1,
    subCategoryId: 1,
    variants: 1,
    rating: 1,
    totalReviews: 1,
    salesCount: 1,
    images: 1,
    isFeatured: 1,
    isActive: 1
  };

  const runQuery = async (query, hasSearch, projection = baseProjection) => {
    const needsDiscountPipeline = sortBy === 'discount_desc' || typeof filters?.discountMin === 'number';
    if (needsDiscountPipeline) {
      const discountMin = typeof filters?.discountMin === 'number' ? filters.discountMin : 0;
      const pipeline = [
        { $match: query },
        {
          $addFields: {
            discountPercent: {
              $max: {
                $map: {
                  input: '$variants',
                  as: 'variant',
                  in: {
                    $cond: [
                      { $and: [{ $gt: ['$$variant.MRP', 0] }, { $gte: ['$$variant.MRP', '$$variant.price'] }] },
                      {
                        $round: [
                          {
                            $multiply: [
                              {
                                $divide: [
                                  { $subtract: ['$$variant.MRP', '$$variant.price'] },
                                  '$$variant.MRP'
                                ]
                              },
                              100
                            ]
                          },
                          0
                        ]
                      },
                      0
                    ]
                  }
                }
              }
            }
          }
        },
        { $match: { discountPercent: { $gte: discountMin } } }
      ];

      const [rows, countRows] = await Promise.all([
        Product.aggregate([
          ...pipeline,
          {
            $sort:
              sortBy === 'discount_desc'
                ? { discountPercent: -1, salesCount: -1, rating: -1 }
                : buildSort(sortBy, hasSearch)
          },
          { $skip: skip },
          { $limit: pageSize },
          { $project: { ...projection, discountPercent: 1 } }
        ]),
        Product.aggregate([...pipeline, { $count: 'count' }])
      ]);

      const items = dedupeProducts(rows);
      const total = countRows?.[0]?.count || 0;
      return { items, total };
    }

    const [rows, count] = await Promise.all([
      Product.find(query, projection)
        .sort(buildSort(sortBy, hasSearch))
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Product.countDocuments(query)
    ]);

    const items = dedupeProducts(
      rows.map((row) => ({ ...row, discountPercent: computeDiscountPercent(row.variants || []) }))
    );
    return { items, total: count };
  };

  try {
    const query = buildProductFilters(filters);
    const { items, total } = await runQuery(query, !!filters?.search);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
  } catch (err) {
    const searchTerm = filters?.search;
    if (!searchTerm) throw err;

    const fallbackQuery = buildProductFilters({ ...filters, search: undefined });
    const regex = new RegExp(escapeRegex(searchTerm), 'i');
    fallbackQuery.$or = [{ name: regex }, { brand: regex }, { slug: regex }, { SKU: regex }];

    // eslint-disable-next-line no-console
    console.warn('listProducts fallback to regex search due to text search error', err?.message || err);

    const { items, total } = await runQuery(fallbackQuery, false, {
      ...baseProjection,
      score: 1
    });
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
  }
};

const findProductById = (id, projection = null, session = null) =>
  Product.findById(id, projection || undefined, { session }).lean();

const findProductsByIds = (ids = [], projection = null, session = null) =>
  Product.find(
    { _id: { $in: ids } },
    projection || undefined,
    { session }
  ).lean();

const findProductBySlug = (slug, projection = null) =>
  Product.findOne({ slug, isActive: true }, projection || undefined).lean();

const decrementVariantStock = ({ productId, variantId, quantity, session }) =>
  Product.findOneAndUpdate(
    {
      _id: productId,
      'variants.variantId': variantId,
      'variants.stock': { $gte: quantity }
    },
    {
      $inc: { 'variants.$.stock': -quantity }
    },
    { returnDocument: 'after', session }
  );

const incrementVariantStock = ({ productId, variantId, quantity, session }) =>
  Product.findOneAndUpdate(
    { _id: productId, 'variants.variantId': variantId },
    { $inc: { 'variants.$.stock': quantity } },
    { returnDocument: 'after', session }
  );

const incrementSalesCount = ({ productId, quantity, session }) =>
  Product.updateOne({ _id: productId }, { $inc: { salesCount: quantity } }, { session });

const findLowStockProducts = async (threshold = 10) =>
  Product.find(
    {
      isActive: true,
      variants: {
        $elemMatch: { stock: { $lt: threshold } }
      }
    },
    {
      name: 1,
      SKU: 1,
      sellerId: 1,
      lowStockThreshold: 1,
      variants: 1
    }
  )
    .lean();

module.exports = {
  listProducts,
  findProductById,
  findProductsByIds,
  findProductBySlug,
  decrementVariantStock,
  incrementVariantStock,
  incrementSalesCount,
  findLowStockProducts
};
