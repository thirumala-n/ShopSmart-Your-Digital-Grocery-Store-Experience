package com.groceryapp.repository;

import com.groceryapp.model.RecentlyViewed;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RecentlyViewedRepository extends JpaRepository<RecentlyViewed, String> {
    Optional<RecentlyViewed> findByUserId(String userId);
}
