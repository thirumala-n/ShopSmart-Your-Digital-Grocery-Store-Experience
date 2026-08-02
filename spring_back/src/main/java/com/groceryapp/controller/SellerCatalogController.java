package com.groceryapp.controller;

import com.groceryapp.model.Product;
import com.groceryapp.security.AuthContext;
import com.groceryapp.service.SellerCatalogService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/seller")
public class SellerCatalogController {
    private final SellerCatalogService sellerCatalogService;

    public SellerCatalogController(SellerCatalogService sellerCatalogService) {
        this.sellerCatalogService = sellerCatalogService;
    }

    @GetMapping("/products")
    public Map<String, Object> listProducts(@RequestParam(required = false) Integer page,
                                            @RequestParam(required = false) Integer pageSize) {
        Map<String, Object> data = sellerCatalogService.listSellerProducts(
                AuthContext.current().getUserId(),
                page == null ? 1 : page,
                pageSize == null ? 20 : pageSize
        );
        Map<String, Object> out = new HashMap<>();
        out.put("success", true);
        out.putAll(data);
        return out;
    }

    @PostMapping("/products/upsert")
    public Map<String, Object> upsertProduct(@RequestBody Map<String, Object> body) {
        Product data = sellerCatalogService.upsertSellerProduct(AuthContext.current().getUserId(), body);
        return Map.of("success", true, "data", data);
    }

    @PatchMapping("/inventory/stock")
    public Map<String, Object> updateStock(@RequestBody Map<String, Object> body) {
        Product data = sellerCatalogService.updateSellerStock(
                AuthContext.current().getUserId(),
                str(body.get("productId")),
                str(body.get("variantId")),
                intVal(body.get("stock"), 0),
                AuthContext.current().getUserId()
        );
        return Map.of("success", true, "data", data);
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private int intVal(Object v, int def) {
        try {
            return Integer.parseInt(str(v));
        } catch (Exception ex) {
            return def;
        }
    }
}
