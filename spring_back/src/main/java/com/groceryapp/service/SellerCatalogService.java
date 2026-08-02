package com.groceryapp.service;

import com.groceryapp.exception.AppException;
import com.groceryapp.model.Product;
import com.groceryapp.model.StockMovement;
import com.groceryapp.repository.ProductRepository;
import com.groceryapp.repository.StockMovementRepository;
import com.groceryapp.util.IdGenerator;
import com.groceryapp.util.PaginationUtil;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
public class SellerCatalogService {
    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;

    public SellerCatalogService(ProductRepository productRepository, StockMovementRepository stockMovementRepository) {
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
    }

    public Map<String, Object> listSellerProducts(String sellerId, Integer pageRaw, Integer pageSizeRaw) {
        int page = PaginationUtil.page(pageRaw);
        int pageSize = PaginationUtil.pageSize(pageSizeRaw);
        Page<Product> result = productRepository.findAll(
                (root, query, cb) -> cb.equal(root.get("sellerId"), sellerId),
                PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "updatedAt"))
        );
        List<Product> items = result.getContent();
        long total = result.getTotalElements();

        return Map.of(
                "items", items,
                "total", total,
                "page", page,
                "pageSize", pageSize,
                "totalPages", Math.max(1, (int) Math.ceil(total / (double) pageSize))
        );
    }

    public Product upsertSellerProduct(String sellerId, Map<String, Object> payload) {
        Instant now = Instant.now();
        String id = str(payload.get("id"));
        if (!id.isBlank()) {
            Product existing = productRepository.findById(id).orElseThrow(() -> new AppException("Product not found", 404, "PRODUCT_NOT_FOUND"));
            if (!Objects.equals(existing.getSellerId(), sellerId)) {
                throw new AppException("Product not found", 404, "PRODUCT_NOT_FOUND");
            }
            existing.setName(str(payload.get("name")));
            existing.setSlug(str(payload.get("slug")));
            existing.setSKU(str(payload.get("SKU")));
            existing.setBrand(str(payload.get("brand")));
            existing.setCategoryId(str(payload.get("categoryId")));
            existing.setSubCategoryId(str(payload.get("subCategoryId")));
            existing.setDescription(str(payload.get("description")));
            existing.setVariants(parseVariants(payload.get("variants")));
            existing.setSellerId(sellerId);
            if (payload.containsKey("images")) existing.setImages(listOfString(payload.get("images")));
            if (payload.containsKey("tags")) existing.setTags(listOfString(payload.get("tags")));
            existing.setUpdatedAt(now);
            return productRepository.save(existing);
        }

        Product product = Product.builder()
                .name(str(payload.get("name")))
                .slug(str(payload.get("slug")))
                .SKU(str(payload.get("SKU")))
                .brand(str(payload.get("brand")))
                .categoryId(str(payload.get("categoryId")))
                .subCategoryId(str(payload.get("subCategoryId")))
                .sellerId(sellerId)
                .description(str(payload.get("description")))
                .variants(parseVariants(payload.get("variants")))
                .images(payload.containsKey("images") ? listOfString(payload.get("images")) : new ArrayList<>())
                .tags(payload.containsKey("tags") ? listOfString(payload.get("tags")) : new ArrayList<>())
                .rating(0d)
                .totalReviews(0)
                .salesCount(0)
                .isFeatured(bool(payload.get("isFeatured")))
                .isActive(false)
                .adminApproved(false)
                .adminReviewNote("")
                .lowStockThreshold(10)
                .createdAt(now)
                .updatedAt(now)
                .build();
        return productRepository.save(product);
    }

    public Product updateSellerStock(String sellerId, String productId, String variantId, int stock, String performedBy) {
        Product product = productRepository.findById(productId).orElseThrow(() -> new AppException("Product not found", 404, "PRODUCT_NOT_FOUND"));
        if (!Objects.equals(product.getSellerId(), sellerId)) {
            throw new AppException("Product not found", 404, "PRODUCT_NOT_FOUND");
        }
        Product.Variant variant = product.getVariants() == null ? null : product.getVariants().stream()
                .filter(v -> Objects.equals(v.getVariantId(), variantId))
                .findFirst()
                .orElse(null);
        if (variant == null) {
            throw new AppException("Variant not found", 404, "VARIANT_NOT_FOUND");
        }
        int delta = stock - (variant.getStock() == null ? 0 : variant.getStock());
        variant.setStock(Math.max(0, stock));
        product.setUpdatedAt(Instant.now());
        Product saved = productRepository.save(product);

        stockMovementRepository.save(StockMovement.builder()
                .productId(saved.getId())
                .variantId(variantId)
                .delta(delta)
                .reason("SELLER_MANUAL_UPDATE")
                .referenceOrderId(null)
                .performedBy(performedBy)
                .createdAt(Instant.now())
                .build());
        return saved;
    }

    private List<Product.Variant> parseVariants(Object obj) {
        if (!(obj instanceof List<?> rows)) return new ArrayList<>();
        List<Product.Variant> out = new ArrayList<>();
        for (Object rowObj : rows) {
            if (!(rowObj instanceof Map<?, ?> any)) continue;
            Map<String, Object> row = new HashMap<>();
            for (Map.Entry<?, ?> e : any.entrySet()) row.put(String.valueOf(e.getKey()), e.getValue());
            String variantId = str(row.get("variantId"));
            out.add(Product.Variant.builder()
                    .variantId(variantId.isBlank() ? IdGenerator.createObjectIdLike() : variantId)
                    .weight(str(row.get("weight")))
                    .price(doubleVal(row.get("price"), 0))
                    .MRP(doubleVal(row.get("MRP"), 0))
                    .stock(Math.max(0, intVal(row.get("stock"), 0)))
                    .skuSuffix(str(row.get("skuSuffix")))
                    .build());
        }
        return out;
    }

    private List<String> listOfString(Object value) {
        if (!(value instanceof List<?> rows)) return new ArrayList<>();
        List<String> out = new ArrayList<>();
        for (Object row : rows) {
            String v = str(row);
            if (!v.isBlank()) out.add(v);
        }
        return out;
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

    private double doubleVal(Object v, double def) {
        try {
            return Double.parseDouble(str(v));
        } catch (Exception ex) {
            return def;
        }
    }

    private boolean bool(Object v) {
        if (v instanceof Boolean b) return b;
        return "true".equalsIgnoreCase(str(v)) || "1".equals(str(v));
    }
}
