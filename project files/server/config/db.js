const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI
    || (process.env.NODE_ENV !== 'production' ? 'mongodb://127.0.0.1:27017/grocery-webapp' : '');

  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20
  });
};

module.exports = connectDB;
