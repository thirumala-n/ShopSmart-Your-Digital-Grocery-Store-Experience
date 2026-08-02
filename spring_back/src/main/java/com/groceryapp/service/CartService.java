package com.groceryapp.service;

import com.groceryapp.exception.AppException;
import com.groceryapp.model.Cart;
import com.groceryapp.model.Product;
import com.groceryapp.repository.CartRepository;
import com.groceryapp.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CartService {
    private final CartRepository cartRepository;
    private final ProductRepository productRepository;
    private final PricingService pricingService;

    public CartService(CartRepository cartRepository, ProductRepository productRepository, PricingService pricingService) {
        this.cartRepository = cartRepository;
        this.productRepository = productRepository;
        this.pricingService = pricingService;
    }

    public Map<String, Object> getCart(String userId) {
        return recalculateCart(userId, null);
    }

    public Map<String, Object> addItem(String userId, String productId, String variantId, int quantity) {
        Cart cart = getOrCreateCart(userId);
        Cart.CartItem existing = cart.getItems().stream()
                .filter(i -> eq(i.getProductId(), productId) && eq(i.getVariantId(), variantId))
                .findFirst().orElse(null);
        if (existing == null) {
            cart.getItems().add(Cart.CartItem.builder().productId(productId).variantId(variantId).quantity(quantity).build());
        } else {
            existing.setQuantity((existing.getQuantity() == null ? 0 : existing.getQuantity()) + quantity);
        }
        cartRepository.save(cart);
        return recalculateCart(userId, null);
    }

    public Map<String, Object> updateItem(String userId, String productId, String variantId, int quantity) {
        if (quantity < 1) {
            throw new AppException("Quantity must be at least 1", 400, "INVALID_QUANTITY");
        }
        Cart cart = getOrCreateCart(userId);
        Cart.CartItem item = cart.getItems().stream()
                .filter(i -> eq(i.getProductId(), productId) && eq(i.getVariantId(), variantId))
                .findFirst().orElse(null);
        if (item == null) {
            throw new AppException("Item not found in cart", 404, "CART_ITEM_NOT_FOUND");
        }
        item.setQuantity(quantity);
        cartRepository.save(cart);
        return recalculateCart(userId, null);
    }

    public Map<String, Object> removeItem(String userId, String productId, String variantId) {
        Cart cart = getOrCreateCart(userId);
        cart.setItems(cart.getItems().stream()
                .filter(i -> !(eq(i.getProductId(), productId) && eq(i.getVariantId(), variantId)))
                .collect(Collectors.toCollection(ArrayList::new)));
        cartRepository.save(cart);
        return recalculateCart(userId, null);
    }

    public Map<String, Object> applyCoupon(String userId, String code) {
        Cart cart = getOrCreateCart(userId);
        String normalized = code == null ? "" : code.trim().toUpperCase();
        cart.setCouponCode(normalized);
        cartRepository.save(cart);
        Map<String, Object> calc = recalculateCart(userId, normalized);
        Map<String, Object> summary = map(calc.get("summary"));
        if (!normalized.equals(summary.getOrDefault("couponCode", ""))) {
            cart.setCouponCode("");
            cartRepository.save(cart);
            throw new AppException("Invalid coupon code", 400, "COUPON_INVALID");
        }
        return calc;
    }

    public Map<String, Object> clearCoupon(String userId) {
        Cart cart = getOrCreateCart(userId);
        cart.setCouponCode("");
        cartRepository.save(cart);
        return recalculateCart(userId, "");
    }

    private Map<String, Object> recalculateCart(String userId, String forceCouponCode) {
        Cart cart = getOrCreateCart(userId);
        Map<String, Product> products = productRepository.findByIdIn(
                cart.getItems().stream().map(Cart.CartItem::getProductId).distinct().toList()
        ).stream().collect(Collectors.toMap(Product::getId, p -> p));

        List<PricingService.CartLine> lines = new ArrayList<>();
        List<String> categories = new ArrayList<>();

        for (Cart.CartItem item : cart.getItems()) {
            Product product = products.get(item.getProductId());
            if (product == null || !Boolean.TRUE.equals(product.getIsActive()) || !Boolean.TRUE.equals(product.getAdminApproved())) {
                continue;
            }
            Product.Variant variant = product.getVariants() == null ? null : product.getVariants().stream()
                    .filter(v -> eq(v.getVariantId(), item.getVariantId()))
                    .findFirst().orElse(null);
            if (variant == null) {
                continue;
            }
            int stock = variant.getStock() == null ? 0 : variant.getStock();
            int requestedQty = item.getQuantity() == null ? 0 : item.getQuantity();
            int qty = Math.min(requestedQty, Math.max(0, stock));
            if (qty <= 0) {
                continue;
            }
            double price = variant.getPrice() == null ? 0 : variant.getPrice();
            double mrp = variant.getMRP() == null ? 0 : variant.getMRP();
            lines.add(new PricingService.CartLine(
                    product.getId(),
                    variant.getVariantId(),
                    product.getName(),
                    variant.getWeight(),
                    qty,
                    price,
                    mrp,
                    round2(qty * price),
                    stock,
                    product.getImages() == null || product.getImages().isEmpty() ? "" : product.getImages().get(0),
                    product.getSellerId(),
                    product.getCategoryId()
            ));
            categories.add(product.getCategoryId());
        }

        String couponCode = forceCouponCode != null ? forceCouponCode : (cart.getCouponCode() == null ? "" : cart.getCouponCode());
        PricingService.PricingSummary pricing = pricingService.calculatePricingSummary(lines, userId, couponCode, categories);

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalMRP", pricing.totalMRP());
        summary.put("totalDiscount", pricing.totalDiscount());
        summary.put("couponCode", pricing.couponResult().valid() ? couponCode.toUpperCase() : "");
        summary.put("couponDiscount", pricing.couponDiscount());
        summary.put("deliveryFee", pricing.deliveryFee());
        summary.put("tax", pricing.tax());
        summary.put("grandTotal", pricing.grandTotal());

        Map<String, Object> out = new HashMap<>();
        out.put("lines", lines.stream().map(this::lineToMap).toList());
        out.put("summary", summary);
        return out;
    }

    private Map<String, Object> lineToMap(PricingService.CartLine line) {
        Map<String, Object> row = new HashMap<>();
        row.put("productId", line.productId());
        row.put("variantId", line.variantId());
        row.put("productName", line.productName());
        row.put("variantLabel", line.variantLabel());
        row.put("quantity", line.quantity());
        row.put("unitPrice", line.unitPrice());
        row.put("unitMRP", line.unitMRP());
        row.put("lineTotal", line.lineTotal());
        row.put("stock", line.stock());
        row.put("image", line.image());
        return row;
    }

    private Cart getOrCreateCart(String userId) {
        Optional<Cart> existing = cartRepository.findByUserId(userId);
        if (existing.isPresent()) {
            Cart cart = existing.get();
            if (cart.getItems() == null) {
                cart.setItems(new ArrayList<>());
            }
            return cart;
        }
        Cart cart = Cart.builder().userId(userId).items(new ArrayList<>()).couponCode("").build();
        return cartRepository.save(cart);
    }

    private Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    private boolean eq(Object a, Object b) {
        return String.valueOf(a).equals(String.valueOf(b));
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
