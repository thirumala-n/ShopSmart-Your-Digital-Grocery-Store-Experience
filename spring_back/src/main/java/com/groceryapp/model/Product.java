package com.groceryapp.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
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
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @NotBlank
    private String name;

    @Column(unique = true)
    private String slug;

    @Column(name = "SKU", unique = true)
    private String SKU;

    private String brand;

    @Column(name = "category_id")
    private String categoryId;

    @Column(name = "sub_category_id")
    private String subCategoryId;

    @Column(name = "seller_id")
    private String sellerId;

    @ElementCollection
    @CollectionTable(name = "product_variants", joinColumns = @JoinColumn(name = "product_id"))
    @Builder.Default
    private List<Variant> variants = new ArrayList<>();

    private Double rating;
    private Integer totalReviews;

    @Column(name = "sales_count")
    private Integer salesCount;

    @ElementCollection
    @CollectionTable(name = "product_images", joinColumns = @JoinColumn(name = "product_id"))
    @Builder.Default
    private List<String> images = new ArrayList<>();

    private String description;

    @ElementCollection
    @CollectionTable(name = "product_tags", joinColumns = @JoinColumn(name = "product_id"))
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Column(name = "is_featured")
    private Boolean isFeatured;

    @Column(name = "is_active")
    private Boolean isActive;

    private Boolean adminApproved;
    private String adminReviewNote;
    private Integer lowStockThreshold;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Embeddable
    public static class Variant {
        private String variantId;
        private String weight;
        private Double price;
        @Column(name = "MRP")
        private Double MRP;
        private Integer stock;
        private String skuSuffix;
    }
}
