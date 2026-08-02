package com.groceryapp.repository;

import com.groceryapp.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, String> {
    List<Category> findByLevelAndIsActiveOrderByDisplayOrderAscNameAsc(Integer level, Boolean isActive);

    List<Category> findByParentCategoryIdAndIsActiveOrderByDisplayOrderAscNameAsc(String parentCategoryId, Boolean isActive);

    Optional<Category> findBySlugAndIsActive(String slug, Boolean isActive);
}
