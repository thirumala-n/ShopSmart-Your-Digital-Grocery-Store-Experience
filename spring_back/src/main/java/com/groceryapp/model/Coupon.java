package com.groceryapp.model;

import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "coupons")
public class Coupon {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    @Column(unique = true)
    private String code;
    private String discountType;
    private Double discountValue;
    private Double maxDiscount;
    private Double minOrderValue;
    private Integer totalUsageLimit;
    private Integer perUserLimit;
    private Integer usedCount;
    @ElementCollection
    @CollectionTable(name = "coupon_usage", joinColumns = @JoinColumn(name = "coupon_id"))
    @Builder.Default
    private List<Usage> usedBy = new ArrayList<>();
    private Instant validFrom;
    private Instant expiryDate;
    @ElementCollection
    @CollectionTable(name = "coupon_applicable_categories", joinColumns = @JoinColumn(name = "coupon_id"))
    @Builder.Default
    private List<String> applicableCategories = new ArrayList<>();
    private String applicableUserSegment;
    @ElementCollection
    @CollectionTable(name = "coupon_specific_users", joinColumns = @JoinColumn(name = "coupon_id"))
    @Builder.Default
    private List<String> specificUserIds = new ArrayList<>();
    private Boolean isActive;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Embeddable
    public static class Usage {
        private String userId;
        private Integer usageCount;
    }
}
