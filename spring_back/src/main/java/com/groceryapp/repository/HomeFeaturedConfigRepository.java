package com.groceryapp.repository;

import com.groceryapp.model.HomeFeaturedConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HomeFeaturedConfigRepository extends JpaRepository<HomeFeaturedConfig, String> {
    Optional<HomeFeaturedConfig> findByKey(String key);
}
