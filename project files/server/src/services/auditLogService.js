const auditLogRepository = require('../repositories/auditLogRepository');

const getRequestMeta = (req) => ({
  ip: String(req?.ip || req?.headers?.['x-forwarded-for'] || ''),
  userAgent: String(req?.headers?.['user-agent'] || '')
});

const createAuditLog = async ({ action, performedBy, targetType, targetId, previousValue = null, newValue = null, req, session = null }) => {
  return auditLogRepository.create(
    {
      action,
      performedBy,
      targetType,
      targetId: String(targetId || ''),
      previousValue,
      newValue,
      ...getRequestMeta(req)
    },
    session
  );
};

const listAuditLogs = ({ page, pageSize, skip }) => auditLogRepository.listPaged({ page, pageSize, skip });

module.exports = {
  createAuditLog,
  listAuditLogs
};
