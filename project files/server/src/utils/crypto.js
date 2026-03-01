const crypto = require('crypto');

const hashValue = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

const generateNumericOtp = (length = 6) => {
  let otp = '';
  for (let i = 0; i < length; i += 1) {
    otp += crypto.randomInt(0, 10);
  }
  return otp;
};

module.exports = { hashValue, generateNumericOtp };
