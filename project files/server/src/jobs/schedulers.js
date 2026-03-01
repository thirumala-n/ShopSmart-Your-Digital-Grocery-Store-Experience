const logger = require('../config/logger');
const inventoryService = require('../services/inventoryService');
const cacheService = require('../services/cacheService');
const orderService = require('../services/orderService');
const accountService = require('../services/accountService');
const orderRepository = require('../repositories/orderRepository');
const { ORDER_STATUS } = require('../utils/constants');

let timersStarted = false;

const cancelExpiredPendingPayments = async () => {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const staleOrders = await orderRepository.listPendingPaymentOrdersBefore({ cutoff, limit: 200 });

  for (const order of staleOrders) {
    try {
      await orderService.transitionOrderStatus({
        orderId: order.orderId,
        nextStatus: ORDER_STATUS.CANCELLED,
        updatedBy: order.userId,
        updatedByRole: 'ADMIN'
      });
    } catch (error) {
      logger.warn(`Failed to auto-cancel stale order ${order.orderId}: ${error.message}`);
    }
  }
};

const refreshLowStockCache = async () => {
  const rows = await inventoryService.scanLowStockVariants();
  cacheService.setLowStockCache(rows);
  return rows.length;
};

const runAccountAnonymization = async () => {
  const count = await accountService.anonymizeDueAccounts();
  return count;
};

const startSchedulers = () => {
  if (timersStarted) return;
  timersStarted = true;

  setInterval(async () => {
    try {
      await cancelExpiredPendingPayments();
    } catch (error) {
      logger.error(`Pending payment cancellation job failed: ${error.message}`);
    }
  }, 60 * 1000);

  setInterval(async () => {
    try {
      const count = await refreshLowStockCache();
      logger.info(`Low stock cache refreshed. rows=${count}`);
    } catch (error) {
      logger.error(`Low stock scan job failed: ${error.message}`);
    }
  }, 60 * 60 * 1000);

  setInterval(async () => {
    try {
      const count = await runAccountAnonymization();
      logger.info(`Account anonymization completed. accounts=${count}`);
    } catch (error) {
      logger.error(`Account anonymization job failed: ${error.message}`);
    }
  }, 24 * 60 * 60 * 1000);
};

module.exports = {
  startSchedulers,
  cancelExpiredPendingPayments,
  refreshLowStockCache,
  runAccountAnonymization
};
