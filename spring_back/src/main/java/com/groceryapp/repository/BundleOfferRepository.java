package com.groceryapp.repository;

import com.groceryapp.model.BundleOffer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface BundleOfferRepository extends JpaRepository<BundleOffer, String> {
    List<BundleOffer> findTop20ByIsActiveAndValidFromLessThanEqualAndValidToGreaterThanEqual(Boolean isActive, Instant from, Instant to);
}
