module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || ''
};
