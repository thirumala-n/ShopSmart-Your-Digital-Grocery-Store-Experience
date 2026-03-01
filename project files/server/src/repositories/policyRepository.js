const PolicyContent = require('../models/PolicyContent');

const getByKey = (key) => PolicyContent.findOne({ key }).lean();

const upsert = (key, payload) =>
  PolicyContent.findOneAndUpdate(
    { key },
    { $set: payload },
    { returnDocument: 'after', upsert: true }
  ).lean();

const listAll = () => PolicyContent.find({}).sort({ key: 1 }).lean();

module.exports = { getByKey, upsert, listAll };
