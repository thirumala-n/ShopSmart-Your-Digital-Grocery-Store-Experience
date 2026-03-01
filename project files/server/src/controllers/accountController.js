const asyncHandler = require('../utils/asyncHandler');
const accountService = require('../services/accountService');

const getProfile = asyncHandler(async (req, res) => {
  const data = await accountService.getProfile(req.auth.userId);
  res.status(200).json({ success: true, data });
});

const updateProfile = asyncHandler(async (req, res) => {
  const data = await accountService.updateProfile({ userId: req.auth.userId, ...req.body });
  res.status(200).json({ success: true, data });
});

const updateNotifications = asyncHandler(async (req, res) => {
  const data = await accountService.setNotificationPreferences({
    userId: req.auth.userId,
    notificationPreferences: req.body
  });
  res.status(200).json({ success: true, data });
});

const updateAddresses = asyncHandler(async (req, res) => {
  const data = await accountService.updateAddresses({ userId: req.auth.userId, addresses: req.body.addresses || [] });
  res.status(200).json({ success: true, data });
});

const listSessions = asyncHandler(async (req, res) => {
  const data = await accountService.listActiveSessions(req.auth.userId);
  res.status(200).json({ success: true, data });
});

const setTwoFactor = asyncHandler(async (req, res) => {
  const data = await accountService.setTwoFactor({
    userId: req.auth.userId,
    enabled: !!req.body.enabled
  });
  res.status(200).json({ success: true, data });
});

const listSavedCards = asyncHandler(async (req, res) => {
  const data = await accountService.listSavedCards(req.auth.userId);
  res.status(200).json({ success: true, data });
});

const addSavedCard = asyncHandler(async (req, res) => {
  const data = await accountService.addSavedCard({
    userId: req.auth.userId,
    card: req.body
  });
  res.status(200).json({ success: true, data });
});

const removeSavedCard = asyncHandler(async (req, res) => {
  const data = await accountService.removeSavedCard({
    userId: req.auth.userId,
    cardId: req.params.cardId
  });
  res.status(200).json({ success: true, data });
});

const setDefaultCard = asyncHandler(async (req, res) => {
  const data = await accountService.setDefaultCard({
    userId: req.auth.userId,
    cardId: req.params.cardId
  });
  res.status(200).json({ success: true, data });
});

const requestDataDownload = asyncHandler(async (req, res) => {
  await accountService.requestDataDownload(req.auth.userId);
  res.status(200).json({ success: true, message: 'Data download request submitted' });
});

const requestProfileOtp = asyncHandler(async (req, res) => {
  await accountService.requestProfileChangeOtp({
    userId: req.auth.userId,
    type: req.body.type,
    value: req.body.value
  });
  res.status(200).json({ success: true, message: 'OTP sent successfully' });
});

const verifyProfileOtp = asyncHandler(async (req, res) => {
  await accountService.verifyProfileChangeOtp({
    userId: req.auth.userId,
    type: req.body.type,
    value: req.body.value,
    otp: req.body.otp
  });
  res.status(200).json({ success: true, message: 'OTP verified successfully' });
});

const changePassword = asyncHandler(async (req, res) => {
  await accountService.changePassword({
    userId: req.auth.userId,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword
  });
  res.status(200).json({ success: true, message: 'Password changed successfully' });
});

const logoutAllDevices = asyncHandler(async (req, res) => {
  await accountService.logoutAllDevices(req.auth.userId);
  res.status(200).json({ success: true, message: 'Logged out from all devices' });
});

const requestDeletion = asyncHandler(async (req, res) => {
  await accountService.requestAccountDeletion(req.auth.userId);
  res.status(200).json({ success: true, message: 'Account deletion requested' });
});

const addRecentlyViewed = asyncHandler(async (req, res) => {
  await accountService.addRecentlyViewed({
    userId: req.auth.userId,
    productId: req.body.productId
  });
  res.status(200).json({ success: true, message: 'Recently viewed updated' });
});

const listRecentlyViewed = asyncHandler(async (req, res) => {
  const data = await accountService.getRecentlyViewed(req.auth.userId);
  res.status(200).json({ success: true, data });
});

module.exports = {
  getProfile,
  updateProfile,
  updateNotifications,
  updateAddresses,
  listSessions,
  setTwoFactor,
  listSavedCards,
  addSavedCard,
  removeSavedCard,
  setDefaultCard,
  requestDataDownload,
  requestProfileOtp,
  verifyProfileOtp,
  changePassword,
  logoutAllDevices,
  requestDeletion,
  addRecentlyViewed,
  listRecentlyViewed
};
