package com.groceryapp.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
@Table(name = "seasonal_sales")
public class SeasonalSale {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String campaignName;
    @Builder.Default
    private List<String> categoryIds = new ArrayList<>();
    private Double discountPercent;
    private String bannerImageUrl;
    private Instant startDate;
    private Instant endDate;
    private Boolean isActive;
    private Instant createdAt;
    private Instant updatedAt;
}
