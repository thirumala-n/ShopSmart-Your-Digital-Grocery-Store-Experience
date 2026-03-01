const validate = (req, res, next) => {
  // Basic request sanitization
  if (req.body && typeof req.body === 'object') {
    // Remove any potential XSS in string fields
    const sanitizeString = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    };

    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') {
        return;
      }

      for (const key of Object.keys(obj)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          delete obj[key];
          continue;
        }

        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(req.body);
  }

  next();
};

module.exports = validate;
