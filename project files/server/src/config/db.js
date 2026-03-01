const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

const connectDB = async () => {
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: env.mongoPoolMax,
    minPoolSize: env.mongoPoolMin,
    autoIndex: false
  });

  logger.info('MongoDB connected');
};

module.exports = { connectDB, mongoose };
