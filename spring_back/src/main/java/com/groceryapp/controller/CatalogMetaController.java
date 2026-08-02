package com.groceryapp.controller;

import com.groceryapp.model.Brand;
import com.groceryapp.model.Category;
import com.groceryapp.service.CatalogService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/meta")
public class CatalogMetaController {
    private final CatalogService catalogService;

    public CatalogMetaController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping("/categories/root")
    public ResponseEntity<Map<String, Object>> listRootCategories() {
        List<Category> roots = catalogService.listRootCategories();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(Map.of(
                        "success", true,
                        "data", roots,
                        "items", roots,
                        "total", roots.size(),
                        "page", 1,
                        "pageSize", roots.size(),
                        "totalPages", 1
                ));
    }

    @GetMapping("/categories/by-slug/{slug}")
    public ResponseEntity<Map<String, Object>> getCategoryBySlug(@PathVariable String slug) {
        return catalogService.getCategoryBySlug(slug)
                .map(data -> ResponseEntity.ok(Map.of("success", true, "data", data)))
                .orElseGet(() -> ResponseEntity.status(404).body(Map.of(
                        "success", false,
                        "code", "CATEGORY_NOT_FOUND",
                        "message", "Category not found"
                )));
    }

    @GetMapping("/categories/{parentId}/subcategories")
    public ResponseEntity<Map<String, Object>> listSubcategories(@PathVariable String parentId) {
        List<Category> items = catalogService.listSubCategories(parentId);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(Map.of(
                        "success", true,
                        "data", items,
                        "items", items,
                        "total", items.size(),
                        "page", 1,
                        "pageSize", items.size(),
                        "totalPages", 1
                ));
    }

    @GetMapping("/brands/featured")
    public ResponseEntity<Map<String, Object>> listFeaturedBrands() {
        List<Brand> items = catalogService.listFeaturedBrands();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(Map.of(
                        "success", true,
                        "data", items,
                        "items", items,
                        "total", items.size(),
                        "page", 1,
                        "pageSize", items.size(),
                        "totalPages", 1
                ));
    }
}
