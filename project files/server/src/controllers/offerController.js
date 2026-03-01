const asyncHandler = require('../utils/asyncHandler');
const offerService = require('../services/offerService');

const getOffersPage = asyncHandler(async (req, res) => {
  const data = await offerService.getOffersPageData();
  res.set('Cache-Control', 'public, max-age=300');
  res.status(200).json({ success: true, data });
});

const getHelpContent = asyncHandler(async (req, res) => {
  const data = await offerService.getHelpContent();
  res.set('Cache-Control', 'public, max-age=300');
  res.status(200).json({ success: true, data });
});

module.exports = { getOffersPage, getHelpContent };
