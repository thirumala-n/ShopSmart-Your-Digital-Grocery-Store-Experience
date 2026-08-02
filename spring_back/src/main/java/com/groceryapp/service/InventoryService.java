package com.groceryapp.service;

import com.groceryapp.config.AppProperties;
import com.groceryapp.exception.AppException;
import com.groceryapp.model.Product;
import com.groceryapp.model.StockMovement;
import com.groceryapp.repository.ProductRepository;
import com.groceryapp.repository.StockMovementRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class InventoryService {
    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;
    private final AppProperties appProperties;

    public InventoryService(ProductRepository productRepository, StockMovementRepository stockMovementRepository, AppProperties appProperties) {
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.appProperties = appProperties;
    }

    public void decrementStockForOrderItems(List<OrderService.PreparedOrderItem> items, String performedBy, String referenceOrderId) {
        List<Object> failures = new ArrayList<>();
        for (OrderService.PreparedOrderItem item : items) {
            Product product = productRepository.findById(item.productId())
                    .orElse(null);
            if (product == null) {
                failures.add(failure(item));
                continue;
            }
            Product.Variant variant = variantById(product, item.variantId());
            if (variant == null || variant.getStock() == null || variant.getStock() < item.quantity()) {
                failures.add(failure(item));
                continue;
            }
            variant.setStock(variant.getStock() - item.quantity());
            productRepository.save(product);
            stockMovementRepository.save(StockMovement.builder()
                    .productId(item.productId())
                    .variantId(item.variantId())
                    .delta(-Math.abs(item.quantity()))
                    .reason("ORDER_CONFIRMED")
                    .referenceOrderId(referenceOrderId)
                    .performedBy(performedBy)
                    .createdAt(Instant.now())
                    .build());
        }
        if (!failures.isEmpty()) {
            throw new AppException("Insufficient stock for one or more items", 409, "INSUFFICIENT_STOCK", failures);
        }
    }

    public void restoreStockForOrderItems(List<OrderService.PreparedOrderItem> items, String performedBy, String referenceOrderId) {
        for (OrderService.PreparedOrderItem item : items) {
            Optional<Product> pOpt = productRepository.findById(item.productId());
            if (pOpt.isEmpty()) {
                continue;
            }
            Product product = pOpt.get();
            Product.Variant variant = variantById(product, item.variantId());
            if (variant == null) {
                continue;
            }
            int current = variant.getStock() == null ? 0 : variant.getStock();
            variant.setStock(current + item.quantity());
            productRepository.save(product);
            stockMovementRepository.save(StockMovement.builder()
                    .productId(item.productId())
                    .variantId(item.variantId())
                    .delta(Math.abs(item.quantity()))
                    .reason("ORDER_CANCELLED")
                    .referenceOrderId(referenceOrderId)
                    .performedBy(performedBy)
                    .createdAt(Instant.now())
                    .build());
        }
    }

    public List<Object> scanLowStockVariants() {
        List<Object> out = new ArrayList<>();
        List<Product> products = productRepository.findAll();
        for (Product product : products) {
            if (!Boolean.TRUE.equals(product.getIsActive())) {
                continue;
            }
            int threshold = product.getLowStockThreshold() == null ? appProperties.getLowStockDefaultThreshold() : product.getLowStockThreshold();
            if (product.getVariants() == null) {
                continue;
            }
            for (Product.Variant variant : product.getVariants()) {
                int stock = variant.getStock() == null ? 0 : variant.getStock();
                if (stock < threshold) {
                    out.add(java.util.Map.of(
                            "productId", product.getId(),
                            "productName", product.getName(),
                            "variantId", variant.getVariantId(),
                            "variantLabel", variant.getWeight(),
                            "stock", stock,
                            "threshold", threshold
                    ));
                }
            }
        }
        return out;
    }

    private Product.Variant variantById(Product product, String variantId) {
        if (product.getVariants() == null) {
            return null;
        }
        for (Product.Variant variant : product.getVariants()) {
            if (variant != null && String.valueOf(variant.getVariantId()).equals(String.valueOf(variantId))) {
                return variant;
            }
        }
        return null;
    }

    private Object failure(OrderService.PreparedOrderItem item) {
        return java.util.Map.of(
                "productId", item.productId(),
                "variantId", item.variantId(),
                "requestedQty", item.quantity()
        );
    }
}
