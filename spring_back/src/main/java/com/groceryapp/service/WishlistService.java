package com.groceryapp.service;

import com.groceryapp.exception.AppException;
import com.groceryapp.model.Product;
import com.groceryapp.model.StockAlertSubscription;
import com.groceryapp.model.Wishlist;
import com.groceryapp.repository.ProductRepository;
import com.groceryapp.repository.StockAlertSubscriptionRepository;
import com.groceryapp.repository.WishlistRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class WishlistService {
    private final WishlistRepository wishlistRepository;
    private final ProductRepository productRepository;
    private final StockAlertSubscriptionRepository stockAlertSubscriptionRepository;

    public WishlistService(
            WishlistRepository wishlistRepository,
            ProductRepository productRepository,
            StockAlertSubscriptionRepository stockAlertSubscriptionRepository
    ) {
        this.wishlistRepository = wishlistRepository;
        this.productRepository = productRepository;
        this.stockAlertSubscriptionRepository = stockAlertSubscriptionRepository;
    }

    public List<Object> listWishlist(String userId) {
        Wishlist wishlist = getOrCreate(userId);
        if (wishlist.getProductIds() == null || wishlist.getProductIds().isEmpty()) {
            return List.of();
        }
        Map<String, Product> products = productRepository.findByIdIn(wishlist.getProductIds()).stream()
                .collect(java.util.stream.Collectors.toMap(Product::getId, p -> p));
        List<Object> out = new ArrayList<>();
        for (String id : wishlist.getProductIds()) {
            Product p = products.get(id);
            if (p == null) {
                continue;
            }
            out.add(Map.of(
                    "_id", p.getId(),
                    "name", p.getName(),
                    "slug", p.getSlug(),
                    "brand", p.getBrand(),
                    "images", p.getImages() == null ? List.of() : p.getImages(),
                    "variants", p.getVariants() == null ? List.of() : p.getVariants()
            ));
        }
        return out;
    }

    public List<Object> addWishlistItem(String userId, String productId) {
        Wishlist wishlist = getOrCreate(userId);
        if (wishlist.getProductIds() == null) {
            wishlist.setProductIds(new ArrayList<>());
        }
        if (!wishlist.getProductIds().contains(productId)) {
            wishlist.getProductIds().add(productId);
            wishlist.setUpdatedAt(Instant.now());
            wishlistRepository.save(wishlist);
        }
        return listWishlist(userId);
    }

    public List<Object> removeWishlistItem(String userId, String productId) {
        Wishlist wishlist = getOrCreate(userId);
        List<String> ids = wishlist.getProductIds() == null ? new ArrayList<>() : new ArrayList<>(wishlist.getProductIds());
        ids.removeIf(id -> Objects.equals(id, productId));
        wishlist.setProductIds(ids);
        wishlist.setUpdatedAt(Instant.now());
        wishlistRepository.save(wishlist);
        return listWishlist(userId);
    }

    public Map<String, Object> subscribeStockAlert(String userId, String productId) {
        Product product = productRepository.findById(productId).orElseThrow(() -> new AppException("Product not found", 404, "PRODUCT_NOT_FOUND"));
        boolean inStock = product.getVariants() != null && product.getVariants().stream().anyMatch(v -> v.getStock() != null && v.getStock() > 0);
        if (inStock) {
            throw new AppException("Product is already in stock", 400, "PRODUCT_ALREADY_IN_STOCK");
        }
        StockAlertSubscription sub = stockAlertSubscriptionRepository.findByUserIdAndProductId(userId, productId)
                .orElse(StockAlertSubscription.builder().userId(userId).productId(productId).createdAt(Instant.now()).build());
        sub.setIsActive(true);
        sub.setUpdatedAt(Instant.now());
        stockAlertSubscriptionRepository.save(sub);
        return Map.of("message", "You will be notified when this product is back in stock");
    }

    private Wishlist getOrCreate(String userId) {
        return wishlistRepository.findByUserId(userId).orElseGet(() -> wishlistRepository.save(
                Wishlist.builder().userId(userId).productIds(new ArrayList<>()).createdAt(Instant.now()).updatedAt(Instant.now()).build()
        ));
    }
}
