package com.groceryapp.repository;

import com.groceryapp.model.PolicyContent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PolicyContentRepository extends JpaRepository<PolicyContent, String> {
    Optional<PolicyContent> findByKey(String key);
}
