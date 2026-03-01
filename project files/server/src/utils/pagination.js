const clampPageSize = (size) => Math.min(100, Math.max(1, Number(size) || 20));

const getPagination = (query) => {
  const pageSize = clampPageSize(query.pageSize);
  const page = Math.max(1, Number(query.page) || 1);
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
};

module.exports = { getPagination, clampPageSize };
