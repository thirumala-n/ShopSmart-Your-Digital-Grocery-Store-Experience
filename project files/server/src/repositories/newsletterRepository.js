const Newsletter = require('../models/Newsletter');

const subscribe = (email) =>
  Newsletter.findOneAndUpdate(
    { email: String(email).toLowerCase() },
    { $setOnInsert: { subscribedAt: new Date() }, $set: { isActive: true } },
    { upsert: true, returnDocument: 'after', rawResult: true }
  );

module.exports = { subscribe };
