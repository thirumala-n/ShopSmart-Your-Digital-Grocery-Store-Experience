const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

const validate = (chains) => async (req, res, next) => {
  await Promise.all(chains.map((chain) => chain.run(req)));
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return next(new AppError('Validation failed', 422, 'VALIDATION_FAILED', result.array()));
  }
  return next();
};

module.exports = validate;
