const lowStockCache = {
  updatedAt: null,
  data: []
};

const setLowStockCache = (rows) => {
  lowStockCache.updatedAt = new Date();
  lowStockCache.data = rows;
};

const getLowStockCache = () => lowStockCache;

module.exports = {
  setLowStockCache,
  getLowStockCache
};
