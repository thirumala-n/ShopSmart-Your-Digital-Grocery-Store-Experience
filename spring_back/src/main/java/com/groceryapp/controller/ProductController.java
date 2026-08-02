package com.groceryapp.controller;

import com.groceryapp.service.CatalogService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final CatalogService catalogService;

    public ProductController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping("/banners/home")
    public ResponseEntity<Map<String, Object>> listHomeBanners() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(Map.of("success", true, "data", catalogService.listHomeBanners()));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listProducts(@RequestParam Map<String, String> queryParams) {
        Map<String, Object> data = catalogService.listProducts(queryParams);
        Map<String, Object> out = new HashMap<>();
        out.put("success", true);
        out.putAll(data);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(out);
    }

    @GetMapping("/by-id/{id}")
    public ResponseEntity<Map<String, Object>> getProductById(@PathVariable String id) {
        return catalogService.getProductById(id)
                .map(data -> ResponseEntity.ok(Map.of("success", true, "data", data)))
                .orElseGet(() -> ResponseEntity.status(404).body(Map.of(
                        "success", false,
                        "code", "NOT_FOUND",
                        "message", "Product not found"
                )));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<Map<String, Object>> getProductBySlug(@PathVariable String slug) {
        return catalogService.getProductBySlugOrId(slug)
                .map(data -> ResponseEntity.ok(Map.of("success", true, "data", data)))
                .orElseGet(() -> ResponseEntity.status(404).body(Map.of(
                        "success", false,
                        "code", "NOT_FOUND",
                        "message", "Product not found"
                )));
    }
}
