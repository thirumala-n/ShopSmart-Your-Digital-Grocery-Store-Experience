package com.groceryapp.service;

import com.groceryapp.model.BundleOffer;
import com.groceryapp.model.Coupon;
import com.groceryapp.model.PolicyContent;
import com.groceryapp.model.SeasonalSale;
import com.groceryapp.repository.*;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class OfferService {
    private final CouponRepository couponRepository;
    private final BundleOfferRepository bundleOfferRepository;
    private final SeasonalSaleRepository seasonalSaleRepository;
    private final ProductRepository productRepository;
    private final PolicyContentRepository policyContentRepository;
    private final CatalogService catalogService;

    public OfferService(
            CouponRepository couponRepository,
            BundleOfferRepository bundleOfferRepository,
            SeasonalSaleRepository seasonalSaleRepository,
            ProductRepository productRepository,
            PolicyContentRepository policyContentRepository,
            CatalogService catalogService
    ) {
        this.couponRepository = couponRepository;
        this.bundleOfferRepository = bundleOfferRepository;
        this.seasonalSaleRepository = seasonalSaleRepository;
        this.productRepository = productRepository;
        this.policyContentRepository = policyContentRepository;
        this.catalogService = catalogService;
    }

    public Map<String, Object> getOffersPageData() {
        Instant now = Instant.now();
        List<Coupon> coupons = couponRepository.findAll().stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .filter(c -> c.getValidFrom() == null || !now.isBefore(c.getValidFrom()))
                .filter(c -> c.getExpiryDate() == null || !now.isAfter(c.getExpiryDate()))
                .limit(20)
                .toList();
        List<BundleOffer> bundles = bundleOfferRepository.findTop20ByIsActiveAndValidFromLessThanEqualAndValidToGreaterThanEqual(true, now, now);
        List<SeasonalSale> seasonal = seasonalSaleRepository.findTop20ByIsActiveAndStartDateLessThanEqualAndEndDateGreaterThanEqual(true, now, now);
        List<Object> discountedProducts = (List<Object>) catalogService.listProducts(Map.of(
                "page", "1",
                "pageSize", "20",
                "sortBy", "discount_desc"
        )).get("items");

        Map<String, Object> out = new HashMap<>();
        out.put("coupons", coupons);
        out.put("bundleOffers", bundles);
        out.put("seasonalSales", seasonal);
        out.put("discountedProducts", discountedProducts);
        return out;
    }

    public Map<String, Object> getHelpContent() {
        Map<String, Object> out = new HashMap<>();
        out.put("returnPolicy", policyContentRepository.findByKey("RETURN_REFUND_POLICY").orElse(null));
        out.put("deliveryInfo", policyContentRepository.findByKey("DELIVERY_INFORMATION").orElse(null));
        out.put("cancellationPolicy", policyContentRepository.findByKey("CANCELLATION_POLICY").orElse(null));
        out.put("cookiePolicy", policyContentRepository.findByKey("COOKIE_POLICY").orElse(null));
        return out;
    }
}
