package com.groceryapp.service;

import com.groceryapp.model.Banner;
import com.groceryapp.model.Brand;
import com.groceryapp.model.Category;
import com.groceryapp.model.Product;
import com.groceryapp.repository.BannerRepository;
import com.groceryapp.repository.BrandRepository;
import com.groceryapp.repository.CategoryRepository;
import com.groceryapp.repository.ProductRepository;
import com.groceryapp.util.PaginationUtil;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class CatalogService {
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;
    private final BannerRepository bannerRepository;

    public CatalogService(
            ProductRepository productRepository,
            CategoryRepository categoryRepository,
            BrandRepository brandRepository,
            BannerRepository bannerRepository
    ) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.brandRepository = brandRepository;
        this.bannerRepository = bannerRepository;
    }

    public Map<String, Object> listProducts(Map<String, String> params) {
        int page = PaginationUtil.page(parseInt(params.get("page"), 1));
        int pageSize = PaginationUtil.pageSize(parseInt(params.get("pageSize"), 20));
        Page<Product> result = productRepository.findAll(
                productListSpec(params),
                PageRequest.of(page - 1, pageSize, resolveSort(params.get("sortBy")))
        );
        List<Product> rawItems = result.getContent();
        List<Map<String, Object>> items = rawItems.stream()
                .filter(p -> matchPriceAndRatingFilters(p, params))
                .map(this::toProductCard)
                .toList();

        long total = result.getTotalElements();

        if (has(params.get("discountMin"))) {
            int discountMin = parseInt(params.get("discountMin"), 0);
            items = items.stream()
                    .filter(i -> ((Number) i.getOrDefault("discountPercent", 0)).intValue() >= discountMin)
                    .toList();
        }

        Map<String, Object> out = new HashMap<>();
        out.put("items", items);
        out.put("total", total);
        out.put("page", page);
        out.put("pageSize", pageSize);
        out.put("totalPages", Math.max(1, (int) Math.ceil(total / (double) pageSize)));
        return out;
    }

    private Specification<Product> productListSpec(Map<String, String> params) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isTrue(root.get("isActive")));
            predicates.add(cb.isTrue(root.get("adminApproved")));
            if (has(params.get("categoryId"))) predicates.add(cb.equal(root.get("categoryId"), params.get("categoryId")));
            if (has(params.get("subCategoryId"))) predicates.add(cb.equal(root.get("subCategoryId"), params.get("subCategoryId")));
            if (has(params.get("sellerId"))) predicates.add(cb.equal(root.get("sellerId"), params.get("sellerId")));
            if (has(params.get("isFeatured"))) predicates.add(cb.equal(root.get("isFeatured"), Boolean.parseBoolean(params.get("isFeatured"))));
            if (has(params.get("brand"))) {
                List<String> brands = Arrays.stream(params.get("brand").split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList();
                if (!brands.isEmpty()) predicates.add(root.get("brand").in(brands));
            }
            if (has(params.get("search"))) {
                String like = "%" + params.get("search").trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("brand")), like),
                        cb.like(cb.lower(root.get("slug")), like),
                        cb.like(cb.lower(root.get("SKU")), like)
                ));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    public Optional<Map<String, Object>> getProductBySlugOrId(String slugOrId) {
        Optional<Product> bySlug = productRepository.findBySlugAndIsActiveTrue(slugOrId);
        if (bySlug.isPresent()) {
            return bySlug.map(this::toProductDetails);
        }
        return productRepository.findById(slugOrId).map(this::toProductDetails);
    }

    public Optional<Map<String, Object>> getProductById(String id) {
        return productRepository.findById(id).map(this::toProductDetails);
    }

    public List<Banner> listHomeBanners() {
        Instant now = Instant.now();
        return bannerRepository.findTop5ByIsActiveAndValidFromLessThanEqualAndValidToGreaterThanEqualOrderByDisplayOrderAsc(true, now, now);
    }

    public List<Category> listRootCategories() {
        return categoryRepository.findByLevelAndIsActiveOrderByDisplayOrderAscNameAsc(0, true);
    }

    public List<Category> listSubCategories(String parentId) {
        return categoryRepository.findByParentCategoryIdAndIsActiveOrderByDisplayOrderAscNameAsc(parentId, true);
    }

    public Optional<Category> getCategoryBySlug(String slug) {
        return categoryRepository.findBySlugAndIsActive(slug, true);
    }

    public List<Brand> listFeaturedBrands() {
        return brandRepository.findTop20ByIsActiveAndIsFeaturedOrderByNameAsc(true, true);
    }

    private boolean has(String val) {
        return val != null && !val.trim().isEmpty();
    }

    private int parseInt(String val, int def) {
        if (!has(val)) {
            return def;
        }
        try {
            return Integer.parseInt(val);
        } catch (NumberFormatException ex) {
            return def;
        }
    }

    private double parseDouble(String val, double def) {
        if (!has(val)) {
            return def;
        }
        try {
            return Double.parseDouble(val);
        } catch (NumberFormatException ex) {
            return def;
        }
    }

    private Sort resolveSort(String sortBy) {
        String key = sortBy == null ? "relevance" : sortBy.toLowerCase(Locale.ROOT);
        return switch (key) {
            case "price_asc", "price_desc" -> Sort.by(Sort.Direction.DESC, "createdAt");
            case "popularity" -> Sort.by(Sort.Direction.DESC, "salesCount");
            case "newest" -> Sort.by(Sort.Direction.DESC, "createdAt");
            case "discount_desc" -> Sort.by(Sort.Order.desc("salesCount"), Sort.Order.desc("rating"));
            default -> Sort.by(Sort.Direction.DESC, "createdAt");
        };
    }

    private int discountPercent(Product product) {
        int max = 0;
        if (product.getVariants() == null) {
            return 0;
        }
        for (Product.Variant variant : product.getVariants()) {
            if (variant == null || variant.getMRP() == null || variant.getPrice() == null || variant.getMRP() <= 0 || variant.getPrice() > variant.getMRP()) {
                continue;
            }
            int pct = (int) Math.round(((variant.getMRP() - variant.getPrice()) / variant.getMRP()) * 100);
            if (pct > max) {
                max = pct;
            }
        }
        return max;
    }

    private boolean matchPriceAndRatingFilters(Product product, Map<String, String> params) {
        double minPrice = parseDouble(params.get("minPrice"), Double.NEGATIVE_INFINITY);
        double maxPrice = parseDouble(params.get("maxPrice"), Double.POSITIVE_INFINITY);
        double minRating = parseDouble(params.get("minRating"), Double.NEGATIVE_INFINITY);
        boolean inStock = "true".equalsIgnoreCase(params.get("inStock"));

        if (product.getRating() != null && product.getRating() < minRating) {
            return false;
        }
        boolean anyVariantMatch = false;
        if (product.getVariants() != null) {
            for (Product.Variant v : product.getVariants()) {
                if (v == null || v.getPrice() == null) {
                    continue;
                }
                if (v.getPrice() < minPrice || v.getPrice() > maxPrice) {
                    continue;
                }
                if (inStock && (v.getStock() == null || v.getStock() <= 0)) {
                    continue;
                }
                anyVariantMatch = true;
                break;
            }
        }
        return anyVariantMatch || (!inStock && !Double.isFinite(minPrice) && !Double.isFinite(maxPrice));
    }

    private Map<String, Object> toProductCard(Product p) {
        Map<String, Object> m = new HashMap<>();
        m.put("_id", p.getId());
        m.put("name", p.getName());
        m.put("slug", p.getSlug());
        m.put("SKU", p.getSKU());
        m.put("brand", p.getBrand());
        m.put("categoryId", p.getCategoryId());
        m.put("subCategoryId", p.getSubCategoryId());
        m.put("variants", p.getVariants());
        m.put("rating", p.getRating());
        m.put("totalReviews", p.getTotalReviews());
        m.put("salesCount", p.getSalesCount());
        m.put("images", p.getImages());
        m.put("isFeatured", p.getIsFeatured());
        m.put("isActive", p.getIsActive());
        m.put("discountPercent", discountPercent(p));
        return m;
    }

    private Map<String, Object> toProductDetails(Product p) {
        Map<String, Object> m = new HashMap<>();
        m.put("_id", p.getId());
        m.put("name", p.getName());
        m.put("slug", p.getSlug());
        m.put("SKU", p.getSKU());
        m.put("brand", p.getBrand());
        m.put("variants", p.getVariants());
        m.put("rating", p.getRating());
        m.put("totalReviews", p.getTotalReviews());
        m.put("images", p.getImages());
        m.put("description", p.getDescription());
        m.put("tags", p.getTags());
        m.put("categoryId", p.getCategoryId());
        m.put("subCategoryId", p.getSubCategoryId());
        return m;
    }
}
