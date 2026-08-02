package com.groceryapp.repository;

import com.groceryapp.model.Banner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface BannerRepository extends JpaRepository<Banner, String> {
    List<Banner> findTop5ByIsActiveAndValidFromLessThanEqualAndValidToGreaterThanEqualOrderByDisplayOrderAsc(
            Boolean isActive,
            Instant validFrom,
            Instant validTo
    );

    List<Banner> findAllByOrderByDisplayOrderAscCreatedAtDesc();
}
