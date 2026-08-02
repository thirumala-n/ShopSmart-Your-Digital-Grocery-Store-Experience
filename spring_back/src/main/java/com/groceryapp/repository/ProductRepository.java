package com.groceryapp.repository;

import com.groceryapp.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, String>, JpaSpecificationExecutor<Product> {
    Optional<Product> findBySlugAndIsActiveTrue(String slug);

    List<Product> findByIdIn(Collection<String> ids);

    List<Product> findBySellerId(String sellerId);

    long countBySellerId(String sellerId);
}
