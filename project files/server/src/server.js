const env = require('./config/env');
const logger = require('./config/logger');
const app = require('./app');
const { connectDB, mongoose } = require('./config/db');
const { startSchedulers } = require('./jobs/schedulers');

const start = async () => {
  await connectDB();
  app.listen(env.port, () => {
    logger.info(`Server listening on port ${env.port}`);
    startSchedulers();
  });
};

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason?.message || reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}`);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

start().catch((err) => {
  logger.error(`Startup failed: ${err.message}`);
  process.exit(1);
});
