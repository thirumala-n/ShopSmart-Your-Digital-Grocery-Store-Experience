package com.groceryapp.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
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
@Table(name = "bundle_offers")
public class BundleOffer {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String name;
    @ElementCollection
    @CollectionTable(name = "bundle_offer_products", joinColumns = @JoinColumn(name = "bundle_offer_id"))
    @Builder.Default
    private List<String> productIds = new ArrayList<>();
    @ElementCollection
    @CollectionTable(name = "bundle_offer_categories", joinColumns = @JoinColumn(name = "bundle_offer_id"))
    @Builder.Default
    private List<String> categoryIds = new ArrayList<>();
    private String discountType;
    private Double discountValue;
    private Instant validFrom;
    private Instant validTo;
    private Boolean isActive;
    private Instant createdAt;
    private Instant updatedAt;
}
