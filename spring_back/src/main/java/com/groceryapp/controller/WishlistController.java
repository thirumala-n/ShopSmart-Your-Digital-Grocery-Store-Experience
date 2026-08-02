package com.groceryapp.controller;

import com.groceryapp.security.AuthContext;
import com.groceryapp.service.WishlistService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/wishlist")
public class WishlistController {
    private final WishlistService wishlistService;

    public WishlistController(WishlistService wishlistService) {
        this.wishlistService = wishlistService;
    }

    @GetMapping
    public Map<String, Object> listWishlist() {
        java.util.List<Object> data = wishlistService.listWishlist(AuthContext.current().getUserId());
        return Map.of(
                "success", true,
                "data", data,
                "items", data,
                "total", data.size(),
                "page", 1,
                "pageSize", data.size(),
                "totalPages", 1
        );
    }

    @PostMapping("/items")
    public Map<String, Object> addWishlistItem(@RequestBody Map<String, Object> body) {
        return Map.of("success", true, "data",
                wishlistService.addWishlistItem(AuthContext.current().getUserId(), str(body.get("productId"))));
    }

    @DeleteMapping("/items")
    public Map<String, Object> removeWishlistItem(@RequestBody Map<String, Object> body) {
        return Map.of("success", true, "data",
                wishlistService.removeWishlistItem(AuthContext.current().getUserId(), str(body.get("productId"))));
    }

    @PostMapping("/notify-stock")
    public Map<String, Object> subscribeStockAlert(@RequestBody Map<String, Object> body) {
        return Map.of("success", true, "data",
                wishlistService.subscribeStockAlert(AuthContext.current().getUserId(), str(body.get("productId"))));
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
