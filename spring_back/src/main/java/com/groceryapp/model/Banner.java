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

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "banners")
public class Banner {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String title;
    private String subtitle;
    private String imageUrl;
    private String ctaText;
    private String ctaLink;
    private Integer displayOrder;
    private Boolean isActive;
    private Instant validFrom;
    private Instant validTo;
    private Instant createdAt;
    private Instant updatedAt;
}
