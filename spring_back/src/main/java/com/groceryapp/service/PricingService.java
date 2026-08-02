package com.groceryapp.service;

import com.groceryapp.config.AppProperties;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PricingService {
    private final AppProperties appProperties;
    private final CouponService couponService;

    public PricingService(AppProperties appProperties, CouponService couponService) {
        this.appProperties = appProperties;
        this.couponService = couponService;
    }

    public PricingSummary calculatePricingSummary(List<CartLine> lines, String userId, String couponCode, List<String> categoryIds) {
        double totalMrp = round2(lines.stream().mapToDouble(line -> line.quantity() * line.unitMRP()).sum());
        double subtotal = round2(lines.stream().mapToDouble(CartLine::lineTotal).sum());
        double totalDiscount = round2(totalMrp - subtotal);

        CouponService.CouponValidationResult couponResult = couponService.validateCoupon(couponCode, userId, subtotal, categoryIds);
        double couponDiscount = couponResult.valid() ? round2(couponResult.discount()) : 0;
        double deliveryFee = subtotal >= appProperties.getFreeDeliveryThreshold() ? 0 : appProperties.getDefaultDeliveryFee();
        double taxable = Math.max(0, subtotal - couponDiscount);
        double tax = round2((taxable * appProperties.getTaxPercent()) / 100d);
        double grandTotal = round2(taxable + tax + deliveryFee);

        return new PricingSummary(
                subtotal,
                totalMrp,
                totalDiscount,
                couponResult,
                couponDiscount,
                round2(deliveryFee),
                tax,
                grandTotal
        );
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    public record CartLine(
            String productId,
            String variantId,
            String productName,
            String variantLabel,
            int quantity,
            double unitPrice,
            double unitMRP,
            double lineTotal,
            int stock,
            String image,
            String sellerId,
            String categoryId
    ) {
    }

    public record PricingSummary(
            double subtotal,
            double totalMRP,
            double totalDiscount,
            CouponService.CouponValidationResult couponResult,
            double couponDiscount,
            double deliveryFee,
            double tax,
            double grandTotal
    ) {
    }
}
