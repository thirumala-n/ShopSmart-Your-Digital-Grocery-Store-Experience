const PaymentTransaction = require('../models/PaymentTransaction');

const createTransaction = (payload, session = null) =>
  PaymentTransaction.create([payload], { session }).then((docs) => docs[0]);

const findByExternalOrderId = (externalOrderId) =>
  PaymentTransaction.findOne({ externalOrderId });

const listByExternalOrderId = (externalOrderId, session = null) =>
  PaymentTransaction.find({ externalOrderId }, null, { session });

const findByExternalPaymentId = (externalPaymentId, session = null) =>
  PaymentTransaction.findOne({ externalPaymentId }, null, { session });

const findByRefundReferenceId = (refundReferenceId, session = null) =>
  PaymentTransaction.findOne({ refundReferenceId }, null, { session });

const findByOrderId = (orderId, session = null) =>
  PaymentTransaction.findOne({ orderId }, null, { session });

const findByIdempotencyKey = (idempotencyKey, session = null) =>
  PaymentTransaction.findOne({ idempotencyKey }, null, { session });

const findById = (id, session = null) => PaymentTransaction.findById(id, null, { session });

const save = (doc, session = null) => doc.save({ session });

module.exports = {
  createTransaction,
  findByExternalOrderId,
  listByExternalOrderId,
  findByExternalPaymentId,
  findByRefundReferenceId,
  findByOrderId,
  findByIdempotencyKey,
  findById,
  save
};
