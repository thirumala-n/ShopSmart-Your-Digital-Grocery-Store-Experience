package com.groceryapp.repository;

import com.groceryapp.model.Brand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BrandRepository extends JpaRepository<Brand, String> {
    List<Brand> findTop20ByIsActiveAndIsFeaturedOrderByNameAsc(Boolean isActive, Boolean isFeatured);
}
