const AppError = require('../utils/AppError');
const { ALLOWED_ORDER_TRANSITIONS, ORDER_STATUS } = require('../utils/constants');

const canTransition = (from, to, paymentStatus) => {
  const allowed = ALLOWED_ORDER_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) return false;
  if (from === ORDER_STATUS.CANCELLED && to === ORDER_STATUS.REFUND_INITIATED && paymentStatus !== 'PAID') {
    return false;
  }
  return true;
};

const assertTransition = ({ currentStatus, nextStatus, paymentStatus }) => {
  if (!canTransition(currentStatus, nextStatus, paymentStatus)) {
    throw new AppError(
      `Invalid order status transition: ${currentStatus} -> ${nextStatus}`,
      400,
      'INVALID_ORDER_TRANSITION'
    );
  }
};

module.exports = { canTransition, assertTransition };
