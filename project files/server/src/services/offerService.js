const offerRepository = require('../repositories/offerRepository');
const policyRepository = require('../repositories/policyRepository');
const productRepository = require('../repositories/productRepository');

const getOffersPageData = async () => {
  const [coupons, bundles, seasonalSales, discountedProducts] = await Promise.all([
    offerRepository.listActiveCoupons(),
    offerRepository.listActiveBundles(),
    offerRepository.listActiveSales(),
    productRepository.listProducts({
      filters: {},
      page: 1,
      pageSize: 20,
      skip: 0,
      sortBy: 'discount_desc'
    })
  ]);

  return {
    coupons,
    bundleOffers: bundles,
    seasonalSales,
    discountedProducts: discountedProducts.items
  };
};

const getHelpContent = async () => {
  const [returnPolicy, deliveryInfo, cancellationPolicy, cookiePolicy] = await Promise.all([
    policyRepository.getByKey('RETURN_REFUND_POLICY'),
    policyRepository.getByKey('DELIVERY_INFORMATION'),
    policyRepository.getByKey('CANCELLATION_POLICY'),
    policyRepository.getByKey('COOKIE_POLICY')
  ]);
  return {
    returnPolicy,
    deliveryInfo,
    cancellationPolicy,
    cookiePolicy
  };
};

module.exports = { getOffersPageData, getHelpContent };
