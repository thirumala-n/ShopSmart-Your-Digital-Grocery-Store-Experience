const { randomBytes, randomUUID } = require('crypto');

const secureToken = (bytes = 8) => randomBytes(bytes).toString('hex').toUpperCase();
const createOrderId = () => `ORD${secureToken(10)}`;
const createOrderGroupId = () => `GRP${secureToken(10)}`;
const createTrackingId = () => `TRK${secureToken(8)}`;
const createBarcode = () => randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();

module.exports = { createOrderId, createOrderGroupId, createTrackingId, createBarcode };
