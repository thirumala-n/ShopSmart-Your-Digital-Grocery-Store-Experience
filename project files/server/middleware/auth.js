const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => process.env.JWT_SECRET || process.env.JWT_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev_jwt_secret');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const allowQueryToken = req.baseUrl === '/api/orders' && req.path === '/stream';
    const queryToken = allowQueryToken ? String(req.query?.token || '').trim() : '';

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : queryToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await User.findById(userId)
      .select('_id name email role isVerified createdAt');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
};

module.exports = auth;
