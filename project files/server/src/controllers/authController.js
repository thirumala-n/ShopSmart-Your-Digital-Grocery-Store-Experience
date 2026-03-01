const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json({ success: true, data: user });
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  res.status(200).json({
    success: true,
    token: data.token,
    user: data.user,
    data
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const data = await authService.refresh(refreshToken);
  res.status(200).json({ success: true, data });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.auth.userId, req.body.refreshToken);
  res.status(200).json({ success: true, message: 'Logged out' });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.auth.userId);
  res.status(200).json({ success: true, message: 'Logged out from all devices' });
});

module.exports = { register, login, refresh, logout, logoutAll };
