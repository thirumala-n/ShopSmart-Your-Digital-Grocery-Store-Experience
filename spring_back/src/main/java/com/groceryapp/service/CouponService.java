package com.groceryapp.service;

import com.groceryapp.exception.AppException;
import com.groceryapp.model.Coupon;
import com.groceryapp.repository.CouponRepository;
import com.groceryapp.repository.OrderRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class CouponService {
    private final CouponRepository couponRepository;
    private final OrderRepository orderRepository;

    public CouponService(CouponRepository couponRepository, OrderRepository orderRepository) {
        this.couponRepository = couponRepository;
        this.orderRepository = orderRepository;
    }

    public CouponValidationResult validateCoupon(String code, String userId, double subtotal, List<String> categoryIds) {
        if (code == null || code.trim().isEmpty()) {
            return CouponValidationResult.invalid("Coupon code missing");
        }
        Coupon coupon = couponRepository.findByCodeAndIsActive(code.trim().toUpperCase(Locale.ROOT), true).orElse(null);
        if (coupon == null) {
            return CouponValidationResult.invalid("Invalid coupon code");
        }

        Instant now = Instant.now();
        if (coupon.getValidFrom() != null && now.isBefore(coupon.getValidFrom())) {
            return CouponValidationResult.invalid("Coupon expired or not started");
        }
        if (coupon.getExpiryDate() != null && now.isAfter(coupon.getExpiryDate())) {
            return CouponValidationResult.invalid("Coupon expired or not started");
        }
        if (coupon.getTotalUsageLimit() != null && coupon.getTotalUsageLimit() > 0
                && (coupon.getUsedCount() == null ? 0 : coupon.getUsedCount()) >= coupon.getTotalUsageLimit()) {
            return CouponValidationResult.invalid("Coupon usage limit reached");
        }
        if (subtotal < (coupon.getMinOrderValue() == null ? 0 : coupon.getMinOrderValue())) {
            return CouponValidationResult.invalid("Minimum order value not met");
        }

        Coupon.Usage usage = (coupon.getUsedBy() == null ? List.<Coupon.Usage>of() : coupon.getUsedBy()).stream()
                .filter(u -> Objects.equals(u.getUserId(), userId))
                .findFirst()
                .orElse(null);
        if (usage != null && usage.getUsageCount() != null
                && usage.getUsageCount() >= (coupon.getPerUserLimit() == null ? 1 : coupon.getPerUserLimit())) {
            return CouponValidationResult.invalid("Per-user coupon limit reached");
        }

        String segment = coupon.getApplicableUserSegment() == null ? "ALL" : coupon.getApplicableUserSegment();
        if ("NEW_USERS".equals(segment) && orderRepository.countByUserId(userId) > 0) {
            return CouponValidationResult.invalid("Coupon is for new users only");
        }
        if ("SPECIFIC".equals(segment) && (coupon.getSpecificUserIds() == null || !coupon.getSpecificUserIds().contains(userId))) {
            return CouponValidationResult.invalid("Coupon not applicable for this user");
        }
        if (coupon.getApplicableCategories() != null && !coupon.getApplicableCategories().isEmpty()) {
            boolean hasMatch = categoryIds.stream().anyMatch(coupon.getApplicableCategories()::contains);
            if (!hasMatch) {
                return CouponValidationResult.invalid("Coupon not applicable for selected products");
            }
        }

        double discount;
        if ("FLAT".equals(coupon.getDiscountType())) {
            discount = Math.min(subtotal, coupon.getDiscountValue() == null ? 0 : coupon.getDiscountValue());
        } else {
            double pct = coupon.getDiscountValue() == null ? 0 : coupon.getDiscountValue();
            discount = (subtotal * pct) / 100d;
            if (coupon.getMaxDiscount() != null && coupon.getMaxDiscount() > 0) {
                discount = Math.min(discount, coupon.getMaxDiscount());
            }
        }

        return CouponValidationResult.valid(coupon, round2(discount));
    }

    public void markCouponUsed(Coupon coupon, String userId) {
        if (coupon == null) {
            return;
        }
        int usedCount = coupon.getUsedCount() == null ? 0 : coupon.getUsedCount();
        coupon.setUsedCount(usedCount + 1);
        List<Coupon.Usage> usageList = coupon.getUsedBy() == null ? new java.util.ArrayList<>() : coupon.getUsedBy();
        Coupon.Usage usage = usageList.stream().filter(u -> Objects.equals(u.getUserId(), userId)).findFirst().orElse(null);
        if (usage == null) {
            usageList.add(Coupon.Usage.builder().userId(userId).usageCount(1).build());
        } else {
            usage.setUsageCount((usage.getUsageCount() == null ? 0 : usage.getUsageCount()) + 1);
        }
        coupon.setUsedBy(usageList);
        couponRepository.save(coupon);
    }

    public CouponValidationResult assertCouponValid(String code, String userId, double subtotal, List<String> categoryIds) {
        CouponValidationResult result = validateCoupon(code, userId, subtotal, categoryIds);
        if (!result.valid()) {
            throw new AppException(result.reason(), 400, "COUPON_INVALID");
        }
        return result;
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    public record CouponValidationResult(boolean valid, double discount, Coupon coupon, String reason) {
        public static CouponValidationResult invalid(String reason) {
            return new CouponValidationResult(false, 0, null, reason);
        }

        public static CouponValidationResult valid(Coupon coupon, double discount) {
            return new CouponValidationResult(true, discount, coupon, null);
        }
    }
}
