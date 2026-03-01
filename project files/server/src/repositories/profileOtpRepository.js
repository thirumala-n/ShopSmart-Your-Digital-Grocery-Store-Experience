const ProfileOtp = require('../models/ProfileOtp');

const createOtp = (payload) => ProfileOtp.create(payload);

const findLatestActiveWithHash = ({ userId, purpose, targetValue }) =>
  ProfileOtp.findOne({
    userId,
    purpose,
    targetValue,
    verifiedAt: null,
    expiresAt: { $gt: new Date() }
  })
    .sort({ createdAt: -1 })
    .select('+otpHash attempts expiresAt verifiedAt');

const findLatestVerified = ({ userId, purpose, targetValue, since }) =>
  ProfileOtp.findOne({
    userId,
    purpose,
    targetValue,
    verifiedAt: { $gte: since }
  })
    .sort({ verifiedAt: -1 })
    .lean();

const save = (doc) => doc.save();

module.exports = {
  createOtp,
  findLatestActiveWithHash,
  findLatestVerified,
  save
};
