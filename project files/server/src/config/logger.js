const { createLogger, format, transports } = require('winston');
const env = require('./env');

const logger = createLogger({
  level: env.logLevel,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: env.appName, env: env.nodeEnv },
  transports: [
    new transports.Console({
      format: env.isProd
        ? format.json()
        : format.combine(format.colorize(), format.timestamp(), format.printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`))
    })
  ]
});

module.exports = logger;
