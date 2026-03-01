const AuditLog = require('../models/AuditLog');

const create = (payload, session = null) => AuditLog.create([payload], { session }).then((docs) => docs[0]);

const listPaged = async ({ page, pageSize, skip }) => {
  const [items, total] = await Promise.all([
    AuditLog.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    AuditLog.countDocuments({})
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1
  };
};

module.exports = {
  create,
  listPaged
};
