package com.groceryapp.service;

import com.groceryapp.exception.AppException;
import com.groceryapp.model.*;
import com.groceryapp.repository.*;
import com.groceryapp.util.IdGenerator;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
public class CatalogAdminService {
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final CouponRepository couponRepository;
    private final BannerRepository bannerRepository;
    private final BrandRepository brandRepository;
    private final BundleOfferRepository bundleOfferRepository;
    private final SeasonalSaleRepository seasonalSaleRepository;
    private final PolicyContentRepository policyContentRepository;
    private final StockMovementRepository stockMovementRepository;

    public CatalogAdminService(
            ProductRepository productRepository,
            CategoryRepository categoryRepository,
            CouponRepository couponRepository,
            BannerRepository bannerRepository,
            BrandRepository brandRepository,
            BundleOfferRepository bundleOfferRepository,
            SeasonalSaleRepository seasonalSaleRepository,
            PolicyContentRepository policyContentRepository,
            StockMovementRepository stockMovementRepository
    ) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.couponRepository = couponRepository;
        this.bannerRepository = bannerRepository;
        this.brandRepository = brandRepository;
        this.bundleOfferRepository = bundleOfferRepository;
        this.seasonalSaleRepository = seasonalSaleRepository;
        this.policyContentRepository = policyContentRepository;
        this.stockMovementRepository = stockMovementRepository;
    }

    public Product upsertProduct(Map<String, Object> payload, String actorUserId) {
        Instant now = Instant.now();
        String id = str(payload.get("id"));
        Product product;
        if (!id.isBlank()) {
            product = productRepository.findById(id).orElseThrow(() -> new AppException("Product not found", 404, "PRODUCT_NOT_FOUND"));
        } else {
            product = new Product();
            product.setCreatedAt(now);
        }

        product.setName(str(payload.get("name")));
        product.setSlug(str(payload.get("slug")));
        product.setSKU(str(payload.get("SKU")));
        product.setBrand(str(payload.get("brand")));
        product.setCategoryId(str(payload.get("categoryId")));
        product.setSubCategoryId(str(payload.get("subCategoryId")));
        String sellerId = str(payload.get("sellerId"));
        product.setSellerId(sellerId.isBlank() ? actorUserId : sellerId);
        product.setDescription(str(payload.get("description")));
        product.setIsFeatured(boolOrDefault(payload.get("isFeatured"), false));
        product.setIsActive(boolOrDefault(payload.get("isActive"), true));
        product.setAdminApproved(true);
        if (product.getAdminReviewNote() == null) {
            product.setAdminReviewNote("");
        }

        List<String> images = listOfString(payload.get("images"));
        if (!images.isEmpty()) {
            product.setImages(images);
        } else if (product.getImages() == null) {
            product.setImages(new ArrayList<>());
        }
        List<String> tags = listOfString(payload.get("tags"));
        if (!tags.isEmpty()) {
            product.setTags(tags);
        } else if (product.getTags() == null) {
            product.setTags(new ArrayList<>());
        }

        List<Product.Variant> variants = parseVariants(payload.get("variants"));
        if (variants.isEmpty()) {
            throw new AppException("At least one variant is required", 422, "VALIDATION_FAILED");
        }
        product.setVariants(variants);

        if (product.getLowStockThreshold() == null) {
            product.setLowStockThreshold(10);
        }
        if (product.getRating() == null) {
            product.setRating(0d);
        }
        if (product.getTotalReviews() == null) {
            product.setTotalReviews(0);
        }
        if (product.getSalesCount() == null) {
            product.setSalesCount(0);
        }
        product.setUpdatedAt(now);
        return productRepository.save(product);
    }

    public void deleteProduct(String id) {
        if (id == null || id.isBlank()) return;
        productRepository.deleteById(id);
    }

    public Category upsertCategory(Map<String, Object> payload) {
        Instant now = Instant.now();
        String id = str(payload.get("id"));
        Category row = id.isBlank() ? new Category() : categoryRepository.findById(id).orElse(new Category());
        if (row.getCreatedAt() == null) row.setCreatedAt(now);

        row.setName(str(payload.get("name")));
        row.setSlug(str(payload.get("slug")));
        row.setIcon(str(payload.get("icon")));
        String parentCategoryId = str(payload.get("parentCategoryId"));
        row.setParentCategoryId(parentCategoryId.isBlank() ? null : parentCategoryId);
        row.setLevel(intVal(payload.get("level"), 0));
        row.setDisplayOrder(intVal(payload.get("displayOrder"), 0));
        row.setIsActive(boolOrDefault(payload.get("isActive"), true));
        row.setUpdatedAt(now);
        return categoryRepository.save(row);
    }

    public void deleteCategory(String id) {
        if (id == null || id.isBlank()) return;
        boolean hasProducts = productRepository.exists((root, query, cb) -> cb.or(
                cb.equal(root.get("categoryId"), id),
                cb.equal(root.get("subCategoryId"), id)
        ));
        if (hasProducts) {
            throw new AppException("Category has assigned products; reassign before deletion", 400, "CATEGORY_HAS_PRODUCTS");
        }
        categoryRepository.deleteById(id);
    }

    public Coupon upsertCoupon(Map<String, Object> payload) {
        Instant now = Instant.now();
        String id = str(payload.get("id"));
        Coupon row = id.isBlank() ? new Coupon() : couponRepository.findById(id).orElse(new Coupon());
        if (row.getCreatedAt() == null) row.setCreatedAt(now);

        row.setCode(str(payload.get("code")).toUpperCase(Locale.ROOT));
        row.setDiscountType(str(payload.get("discountType")));
        row.setDiscountValue(doubleVal(payload.get("discountValue"), 0));
        row.setMaxDiscount(doubleVal(payload.get("maxDiscount"), 0));
        row.setMinOrderValue(doubleVal(payload.get("minOrderValue"), 0));
        row.setTotalUsageLimit(intVal(payload.get("totalUsageLimit"), 0));
        row.setPerUserLimit(Math.max(1, intVal(payload.get("perUserLimit"), 1)));
        row.setValidFrom(parseInstant(payload.get("validFrom")));
        row.setExpiryDate(parseInstant(payload.get("expiryDate")));
        row.setIsActive(boolOrDefault(payload.get("isActive"), true));
        if (payload.containsKey("applicableCategories")) {
            row.setApplicableCategories(listOfString(payload.get("applicableCategories")));
        }
        if (payload.containsKey("applicableUserSegment")) {
            row.setApplicableUserSegment(str(payload.get("applicableUserSegment")));
        }
        if (payload.containsKey("specificUserIds")) {
            row.setSpecificUserIds(listOfString(payload.get("specificUserIds")));
        }
        if (row.getUsedCount() == null) row.setUsedCount(0);
        if (row.getUsedBy() == null) row.setUsedBy(new ArrayList<>());
        row.setUpdatedAt(now);
        return couponRepository.save(row);
    }

    public Banner upsertBanner(Map<String, Object> payload) {
        Instant now = Instant.now();
        String id = str(payload.get("id"));
        Banner row = id.isBlank() ? new Banner() : bannerRepository.findById(id).orElse(new Banner());
        if (row.getCreatedAt() == null) row.setCreatedAt(now);

        row.setTitle(str(payload.get("title")));
        row.setSubtitle(str(payload.get("subtitle")));
        row.setImageUrl(str(payload.get("imageUrl")));
        row.setCtaText(str(payload.get("ctaText")));
        row.setCtaLink(str(payload.get("ctaLink")));
        row.setDisplayOrder(intVal(payload.get("displayOrder"), 0));
        row.setIsActive(boolOrDefault(payload.get("isActive"), true));
        row.setValidFrom(parseInstant(payload.get("validFrom")));
        row.setValidTo(parseInstant(payload.get("validTo")));
        row.setUpdatedAt(now);
        return bannerRepository.save(row);
    }

    public Brand upsertBrand(Map<String, Object> payload) {
        Instant now = Instant.now();
        String id = str(payload.get("id"));
        Brand row = id.isBlank() ? new Brand() : brandRepository.findById(id).orElse(new Brand());
        if (row.getCreatedAt() == null) row.setCreatedAt(now);

        row.setName(str(payload.get("name")));
        row.setSlug(str(payload.get("slug")));
        row.setLogoUrl(str(payload.get("logoUrl")));
        row.setIsFeatured(boolOrDefault(payload.get("isFeatured"), false));
        row.setIsActive(boolOrDefault(payload.get("isActive"), true));
        return brandRepository.save(row);
    }

    public BundleOffer upsertBundleOffer(Map<String, Object> payload) {
        Instant now = Instant.now();
        String id = str(payload.get("id"));
        BundleOffer row = id.isBlank() ? new BundleOffer() : bundleOfferRepository.findById(id).orElse(new BundleOffer());
        if (row.getCreatedAt() == null) row.setCreatedAt(now);

        row.setName(str(payload.get("name")));
        row.setProductIds(listOfString(payload.get("productIds")));
        row.setCategoryIds(listOfString(payload.get("categoryIds")));
        row.setDiscountType(str(payload.get("discountType")));
        row.setDiscountValue(doubleVal(payload.get("discountValue"), 0));
        row.setValidFrom(parseInstant(payload.get("validFrom")));
        row.setValidTo(parseInstant(payload.get("validTo")));
        row.setIsActive(boolOrDefault(payload.get("isActive"), true));
        row.setUpdatedAt(now);
        return bundleOfferRepository.save(row);
    }

    public SeasonalSale upsertSeasonalSale(Map<String, Object> payload) {
        Instant now = Instant.now();
        String id = str(payload.get("id"));
        SeasonalSale row = id.isBlank() ? new SeasonalSale() : seasonalSaleRepository.findById(id).orElse(new SeasonalSale());
        if (row.getCreatedAt() == null) row.setCreatedAt(now);

        row.setCampaignName(str(payload.get("campaignName")));
        row.setCategoryIds(listOfString(payload.get("categoryIds")));
        row.setDiscountPercent(doubleVal(payload.get("discountPercent"), 0));
        row.setBannerImageUrl(str(payload.get("bannerImageUrl")));
        row.setStartDate(parseInstant(payload.get("startDate")));
        row.setEndDate(parseInstant(payload.get("endDate")));
        row.setIsActive(boolOrDefault(payload.get("isActive"), true));
        row.setUpdatedAt(now);
        return seasonalSaleRepository.save(row);
    }

    public PolicyContent upsertPolicyContent(Map<String, Object> payload) {
        Instant now = Instant.now();
        String key = str(payload.get("key"));
        PolicyContent row = policyContentRepository.findByKey(key).orElse(new PolicyContent());
        if (row.getCreatedAt() == null) row.setCreatedAt(now);

        row.setKey(key);
        row.setTitle(str(payload.get("title")));
        row.setContentHtml(str(payload.get("contentHtml")));
        row.setUpdatedBy(str(payload.get("updatedBy")));
        row.setUpdatedAt(now);
        return policyContentRepository.save(row);
    }

    public Product updateVariantStock(String productId, String variantId, int stock, String performedBy, String reason) {
        Product product = productRepository.findById(productId).orElseThrow(() -> new AppException("Product not found", 404, "PRODUCT_NOT_FOUND"));
        Product.Variant variant = product.getVariants() == null ? null : product.getVariants().stream()
                .filter(v -> Objects.equals(v.getVariantId(), variantId))
                .findFirst().orElse(null);
        if (variant == null) {
            throw new AppException("Variant not found", 404, "VARIANT_NOT_FOUND");
        }
        int prev = variant.getStock() == null ? 0 : variant.getStock();
        int delta = stock - prev;
        variant.setStock(stock);
        product.setUpdatedAt(Instant.now());
        Product saved = productRepository.save(product);

        StockMovement move = StockMovement.builder()
                .productId(saved.getId())
                .variantId(variantId)
                .delta(delta)
                .reason(reason == null || reason.isBlank() ? "ADMIN_MANUAL_STOCK_UPDATE" : reason)
                .referenceOrderId(null)
                .performedBy(performedBy)
                .createdAt(Instant.now())
                .build();
        stockMovementRepository.save(move);
        return saved;
    }

    public Product updateLowStockThreshold(String productId, int threshold) {
        Product product = productRepository.findById(productId).orElseThrow(() -> new AppException("Product not found", 404, "PRODUCT_NOT_FOUND"));
        product.setLowStockThreshold(Math.max(0, threshold));
        product.setUpdatedAt(Instant.now());
        return productRepository.save(product);
    }

    public List<Banner> reorderBanners(List<String> bannerIds) {
        List<String> ids = bannerIds == null ? List.of() : bannerIds;
        int idx = 1;
        for (String id : ids) {
            bannerRepository.findById(id).ifPresent(row -> {
                row.setDisplayOrder(ids.indexOf(id) + 1);
                row.setUpdatedAt(Instant.now());
                bannerRepository.save(row);
            });
            idx++;
        }
        return bannerRepository.findAllByOrderByDisplayOrderAscCreatedAtDesc();
    }

    private List<Product.Variant> parseVariants(Object obj) {
        if (!(obj instanceof List<?> raw)) {
            return new ArrayList<>();
        }
        List<Product.Variant> out = new ArrayList<>();
        for (Object rowObj : raw) {
            if (!(rowObj instanceof Map<?, ?> rowAny)) continue;
            Map<String, Object> row = castMap(rowAny);
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

    private Map<String, Object> castMap(Map<?, ?> in) {
        Map<String, Object> out = new HashMap<>();
        for (Map.Entry<?, ?> entry : in.entrySet()) {
            out.put(String.valueOf(entry.getKey()), entry.getValue());
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

    private Instant parseInstant(Object value) {
        String raw = str(value);
        if (raw.isBlank()) return null;
        try {
            return Instant.parse(raw);
        } catch (Exception ignored) {
            try {
                return java.time.OffsetDateTime.parse(raw).toInstant();
            } catch (Exception ignored2) {
                try {
                    return java.time.LocalDate.parse(raw).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
                } catch (Exception ignored3) {
                    return null;
                }
            }
        }
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

    private boolean boolOrDefault(Object v, boolean def) {
        if (v == null) return def;
        if (v instanceof Boolean b) return b;
        String s = str(v);
        if (s.isBlank()) return def;
        return "true".equalsIgnoreCase(s) || "1".equals(s) || "yes".equalsIgnoreCase(s);
    }
}
