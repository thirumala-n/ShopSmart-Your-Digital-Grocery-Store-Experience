package com.groceryapp.controller;

import com.groceryapp.security.AuthContext;
import com.groceryapp.service.CartService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/cart")
public class CartController {
    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    public Map<String, Object> getCart() {
        return Map.of("success", true, "data", cartService.getCart(AuthContext.current().getUserId()));
    }

    @PostMapping("/items")
    public Map<String, Object> addItem(@RequestBody Map<String, Object> body) {
        String userId = AuthContext.current().getUserId();
        String productId = str(body.get("productId"));
        String variantId = str(body.get("variantId"));
        int quantity = intVal(body.get("quantity"), 1);
        return Map.of("success", true, "data", cartService.addItem(userId, productId, variantId, quantity));
    }

    @PatchMapping("/items")
    public Map<String, Object> updateItem(@RequestBody Map<String, Object> body) {
        String userId = AuthContext.current().getUserId();
        String productId = str(body.get("productId"));
        String variantId = str(body.get("variantId"));
        int quantity = intVal(body.get("quantity"), 1);
        return Map.of("success", true, "data", cartService.updateItem(userId, productId, variantId, quantity));
    }

    @DeleteMapping("/items")
    public Map<String, Object> removeItem(@RequestBody Map<String, Object> body) {
        String userId = AuthContext.current().getUserId();
        String productId = str(body.get("productId"));
        String variantId = str(body.get("variantId"));
        return Map.of("success", true, "data", cartService.removeItem(userId, productId, variantId));
    }

    @PostMapping("/coupon")
    public Map<String, Object> applyCoupon(@RequestBody Map<String, Object> body) {
        String userId = AuthContext.current().getUserId();
        String code = str(body.get("code"));
        return Map.of("success", true, "data", cartService.applyCoupon(userId, code));
    }

    @DeleteMapping("/coupon")
    public Map<String, Object> clearCoupon() {
        String userId = AuthContext.current().getUserId();
        return Map.of("success", true, "data", cartService.clearCoupon(userId));
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
