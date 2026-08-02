package com.groceryapp.controller;

import com.groceryapp.model.*;
import com.groceryapp.security.AuthContext;
import com.groceryapp.service.AuditLogService;
import com.groceryapp.service.CatalogAdminService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminCatalogController {
    private final CatalogAdminService catalogAdminService;
    private final AuditLogService auditLogService;

    public AdminCatalogController(CatalogAdminService catalogAdminService, AuditLogService auditLogService) {
        this.catalogAdminService = catalogAdminService;
        this.auditLogService = auditLogService;
    }

    @PostMapping("/products/upsert")
    public Map<String, Object> upsertProduct(@RequestBody Map<String, Object> body) {
        Product data = catalogAdminService.upsertProduct(body, AuthContext.current().getUserId());
        return Map.of("success", true, "data", data);
    }

    @DeleteMapping("/products/{id}")
    public Map<String, Object> deleteProduct(@PathVariable String id) {
        catalogAdminService.deleteProduct(id);
        return Map.of("success", true, "message", "Product deleted");
    }

    @PostMapping("/categories/upsert")
    public Map<String, Object> upsertCategory(@RequestBody Map<String, Object> body) {
        Category data = catalogAdminService.upsertCategory(body);
        return Map.of("success", true, "data", data);
    }

    @DeleteMapping("/categories/{id}")
    public Map<String, Object> deleteCategory(@PathVariable String id) {
        catalogAdminService.deleteCategory(id);
        return Map.of("success", true, "message", "Category deleted");
    }

    @PostMapping("/coupons/upsert")
    public Map<String, Object> upsertCoupon(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        Coupon data = catalogAdminService.upsertCoupon(body);
        auditLogService.createAuditLog(
                "COUPON_UPSERT",
                AuthContext.current().getUserId(),
                "COUPON",
                data.getId() == null ? str(body.get("code")) : data.getId(),
                null,
                data,
                request
        );
        return Map.of("success", true, "data", data);
    }

    @PostMapping("/banners/upsert")
    public Map<String, Object> upsertBanner(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        Banner data = catalogAdminService.upsertBanner(body);
        auditLogService.createAuditLog(
                "BANNER_UPSERT",
                AuthContext.current().getUserId(),
                "BANNER",
                data.getId() == null ? str(body.get("title")) : data.getId(),
                null,
                data,
                request
        );
        return Map.of("success", true, "data", data);
    }

    @PostMapping("/brands/upsert")
    public Map<String, Object> upsertBrand(@RequestBody Map<String, Object> body) {
        Brand data = catalogAdminService.upsertBrand(body);
        return Map.of("success", true, "data", data);
    }

    @PostMapping("/bundle-offers/upsert")
    public Map<String, Object> upsertBundleOffer(@RequestBody Map<String, Object> body) {
        BundleOffer data = catalogAdminService.upsertBundleOffer(body);
        return Map.of("success", true, "data", data);
    }

    @PostMapping("/seasonal-sales/upsert")
    public Map<String, Object> upsertSeasonalSale(@RequestBody Map<String, Object> body) {
        SeasonalSale data = catalogAdminService.upsertSeasonalSale(body);
        return Map.of("success", true, "data", data);
    }

    @PostMapping("/policies/upsert")
    public Map<String, Object> upsertPolicyContent(@RequestBody Map<String, Object> body) {
        body.put("updatedBy", AuthContext.current().getUserId());
        PolicyContent data = catalogAdminService.upsertPolicyContent(body);
        return Map.of("success", true, "data", data);
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
