const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  const status = Number(err.statusCode || 500);
  const code = err.code || (status >= 500 ? 'SERVER_ERROR' : 'REQUEST_ERROR');
  logger.error(`${req.method} ${req.originalUrl} ${status} ${err.message}`);

  res.status(status).json({
    success: false,
    code,
    message: err.message || 'Unexpected error',
    details: err.details || undefined
  });
};

module.exports = errorHandler;
