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
@Table(name = "home_featured_configs")
public class HomeFeaturedConfig {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    @Column(unique = true)
    private String key;
    @ElementCollection
    @CollectionTable(name = "home_featured_config_items", joinColumns = @JoinColumn(name = "home_featured_config_id"))
    @Builder.Default
    private List<HomeFeaturedItem> items = new ArrayList<>();
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Embeddable
    public static class HomeFeaturedItem {
        private String section;
        private String productId;
        private String imageUrl;
        private Integer displayOrder;
        private Boolean isActive;
    }
}
