const zlib = require('zlib');

const MIN_SIZE = 1024;

const isCompressibleType = (contentType = '') => {
  const value = String(contentType).toLowerCase();
  return (
    value.startsWith('application/json') ||
    value.startsWith('text/') ||
    value.includes('javascript') ||
    value.includes('xml')
  );
};

const compressionMiddleware = (req, res, next) => {
  const acceptsGzip = String(req.headers['accept-encoding'] || '').includes('gzip');
  if (!acceptsGzip) return next();

  const originalSend = res.send.bind(res);
  res.send = (body) => {
    const contentType = String(res.getHeader('Content-Type') || '');
    if (!isCompressibleType(contentType)) {
      return originalSend(body);
    }

    let rawBody = body;
    if (rawBody === undefined || rawBody === null) return originalSend(rawBody);

    if (!Buffer.isBuffer(rawBody)) {
      if (typeof rawBody === 'object') {
        rawBody = Buffer.from(JSON.stringify(rawBody));
      } else {
        rawBody = Buffer.from(String(rawBody));
      }
    }

    if (rawBody.length < MIN_SIZE) return originalSend(rawBody);

    try {
      const compressed = zlib.gzipSync(rawBody);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      return originalSend(compressed);
    } catch (_error) {
      return originalSend(rawBody);
    }
  };

  return next();
};

module.exports = compressionMiddleware;
