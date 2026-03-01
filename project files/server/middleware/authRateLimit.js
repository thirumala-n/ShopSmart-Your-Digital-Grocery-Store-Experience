const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const MAX_TRACKED_KEYS = 5000;

const requestMap = new Map();

const authRateLimit = (req, res, next) => {
  const ipAddress = String(
    req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  ).split(',')[0].trim();
  const key = `${ipAddress}:${req.path}`;
  const now = Date.now();

  if (requestMap.size > MAX_TRACKED_KEYS) {
    for (const [trackedKey, tracked] of requestMap.entries()) {
      if (!tracked || now > tracked.resetAt) {
        requestMap.delete(trackedKey);
      }
    }
  }

  const existing = requestMap.get(key);

  if (!existing || now > existing.resetAt) {
    requestMap.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS
    });
    return next();
  }

  if (existing.count >= MAX_ATTEMPTS) {
    const secondsLeft = Math.ceil((existing.resetAt - now) / 1000);
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: Math.max(1, secondsLeft)
    });
  }

  existing.count += 1;
  requestMap.set(key, existing);
  return next();
};

module.exports = authRateLimit;
