package com.groceryapp.service;

import com.groceryapp.exception.AppException;
import com.groceryapp.model.*;
import com.groceryapp.repository.*;
import com.groceryapp.util.PaginationUtil;
import com.groceryapp.util.Roles;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class AdminService {
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final BannerRepository bannerRepository;
    private final StockMovementRepository stockMovementRepository;
    private final HomeFeaturedConfigRepository homeFeaturedConfigRepository;
    private final CatalogAdminService catalogAdminService;
    private final InventoryService inventoryService;
    private final CacheService cacheService;
    private final AuditLogService auditLogService;

    public AdminService(
            OrderRepository orderRepository,
            UserRepository userRepository,
            ProductRepository productRepository,
            BannerRepository bannerRepository,
            StockMovementRepository stockMovementRepository,
            HomeFeaturedConfigRepository homeFeaturedConfigRepository,
            CatalogAdminService catalogAdminService,
            InventoryService inventoryService,
            CacheService cacheService,
            AuditLogService auditLogService
    ) {
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.bannerRepository = bannerRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.homeFeaturedConfigRepository = homeFeaturedConfigRepository;
        this.catalogAdminService = catalogAdminService;
        this.inventoryService = inventoryService;
        this.cacheService = cacheService;
        this.auditLogService = auditLogService;
    }

    public Map<String, Object> listOrders(Map<String, String> params) {
        int page = PaginationUtil.page(intVal(params.get("page"), 1));
        int pageSize = PaginationUtil.pageSize(intVal(params.get("pageSize"), 20));
        Page<Order> result = orderRepository.findAll(
                adminOrderSpec(params),
                PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        List<Order> items = result.getContent();
        long total = result.getTotalElements();

        Map<String, Object> out = new HashMap<>();
        out.put("items", items);
        out.put("total", total);
        out.put("page", page);
        out.put("pageSize", pageSize);
        out.put("totalPages", totalPages(total, pageSize));
        return out;
    }

    public Map<String, Object> lowStockAlerts(boolean forceFresh) {
        Map<String, Object> cached = cacheService.getLowStockCache();
        Instant updatedAt = (Instant) cached.get("updatedAt");
        if (updatedAt != null && !forceFresh) {
            List<Object> rows = castList(cached.get("data"));
            return pagedRows(rows, updatedAt, "cache");
        }
        List<Object> data = inventoryService.scanLowStockVariants();
        cacheService.setLowStockCache(data);
        return pagedRows(data, Instant.now(), "fresh");
    }

    public Map<String, Object> listUsers(Map<String, String> params) {
        int page = PaginationUtil.page(intVal(params.get("page"), 1));
        int pageSize = PaginationUtil.pageSize(intVal(params.get("pageSize"), 20));
        Page<User> result = userRepository.findAll(
                adminUserSpec(params),
                PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        List<User> users = result.getContent();
        long total = result.getTotalElements();

        List<Map<String, Object>> items = users.stream().map(user -> {
            Map<String, Object> row = new HashMap<>();
            row.put("_id", user.getId());
            row.put("name", user.getName());
            row.put("email", user.getEmail());
            row.put("phone", user.getPhone());
            row.put("role", user.getRole());
            row.put("accountStatus", user.getAccountStatus());
            row.put("createdAt", user.getCreatedAt());
            return row;
        }).toList();

        return Map.of(
                "items", items,
                "total", total,
                "page", page,
                "pageSize", pageSize,
                "totalPages", totalPages(total, pageSize)
        );
    }

    public String blockUser(String id, boolean block, String reason) {
        userRepository.findById(id).ifPresent(user -> {
            user.setAccountStatus(block ? "BLOCKED" : "ACTIVE");
            user.setBlockReason(block ? str(reason) : "");
            user.setRefreshTokens(new ArrayList<>());
            user.setUpdatedAt(Instant.now());
            userRepository.save(user);
        });
        return block ? "User blocked" : "User unblocked";
    }

    public Map<String, Object> updateUserRole(String id, String role, String performedBy, HttpServletRequest request) {
        User existing = userRepository.findById(id).orElseThrow(() -> new AppException("User not found", 404, "USER_NOT_FOUND"));
        String previousRole = existing.getRole();
        existing.setRole(str(role));
        existing.setUpdatedAt(Instant.now());
        User saved = userRepository.save(existing);

        auditLogService.createAuditLog(
                "ROLE_CHANGE",
                performedBy,
                "USER",
                id,
                Map.of("role", previousRole),
                Map.of("role", saved.getRole()),
                request
        );
        return Map.of("id", saved.getId(), "email", saved.getEmail(), "role", saved.getRole());
    }

    public Map<String, Object> dashboardMetrics() {
        Instant todayStart = LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant yesterdayStart = todayStart.minusSeconds(24L * 60 * 60);
        Summary today = ordersRevenueSummary(todayStart, null);
        Summary yesterday = ordersRevenueSummary(yesterdayStart, todayStart);
        List<Object> lowStock = inventoryService.scanLowStockVariants();
        long activeUsers = userRepository.countByAccountStatus("ACTIVE");
        double revenueDeltaPct = yesterday.revenue() == 0
                ? 100
                : round2(((today.revenue() - yesterday.revenue()) / yesterday.revenue()) * 100);

        return Map.of(
                "todayRevenue", today.revenue(),
                "todayOrders", today.orders(),
                "activeUsers", activeUsers,
                "lowStockCount", lowStock.size(),
                "revenueDeltaPct", revenueDeltaPct
        );
    }

    public Map<String, Object> dashboardAnalytics(Map<String, String> params) {
        int rangeDays = intVal(params.get("rangeDays"), 30);
        if (!List.of(7, 30, 90).contains(rangeDays)) rangeDays = 30;
        Instant fromDate = parseInstant(params.get("fromDate"), false);
        Instant toDate = parseInstant(params.get("toDate"), true);
        Instant startDate = fromDate != null ? fromDate : LocalDate.now(ZoneOffset.UTC).minusDays(rangeDays - 1L).atStartOfDay().toInstant(ZoneOffset.UTC);

        Summary today = ordersRevenueSummary(LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC), null);
        Summary yesterday = ordersRevenueSummary(LocalDate.now(ZoneOffset.UTC).minusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC), LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC));
        long activeUsers = userRepository.countByAccountStatus("ACTIVE");
        double revenueDeltaPct = yesterday.revenue() == 0
                ? 100
                : round2(((today.revenue() - yesterday.revenue()) / yesterday.revenue()) * 100);

        List<Order> rangeOrders = listOrdersByCreatedAt(startDate, toDate);
        List<Map<String, Object>> revenueSeries = buildRevenueSeries(rangeOrders);
        List<Map<String, Object>> ordersByStatus = buildOrdersByStatus(rangeOrders);
        List<Map<String, Object>> topSellingProducts = buildTopSellingProducts(rangeOrders, 10);
        List<Object> lowStock = inventoryService.scanLowStockVariants();
        List<Map<String, Object>> recentOrders = buildRecentOrders(rangeOrders, 10);

        return Map.of(
                "metrics", Map.of(
                        "todayRevenue", today.revenue(),
                        "todayOrders", today.orders(),
                        "activeUsers", activeUsers,
                        "revenueDeltaPct", revenueDeltaPct,
                        "lowStockCount", lowStock.size()
                ),
                "revenueSeries", revenueSeries,
                "ordersByStatus", ordersByStatus,
                "topSellingProducts", topSellingProducts,
                "lowStock", lowStock,
                "recentOrders", recentOrders
        );
    }

    public Map<String, Object> listStockMovements(Map<String, String> params) {
        int page = PaginationUtil.page(intVal(params.get("page"), 1));
        int pageSize = PaginationUtil.pageSize(intVal(params.get("pageSize"), 20));
        Page<StockMovement> result = stockMovementRepository.findAll(
                stockMovementSpec(params),
                PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        List<StockMovement> items = result.getContent();
        long total = result.getTotalElements();

        return Map.of(
                "items", items,
                "total", total,
                "page", page,
                "pageSize", pageSize,
                "totalPages", totalPages(total, pageSize)
        );
    }

    public Map<String, Object> listPendingSellerProducts(Map<String, String> params) {
        int page = PaginationUtil.page(intVal(params.get("page"), 1));
        int pageSize = PaginationUtil.pageSize(intVal(params.get("pageSize"), 20));
        Page<Product> result = productRepository.findAll(
                (root, query, cb) -> cb.isFalse(root.get("adminApproved")),
                PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        List<Product> products = result.getContent();
        long total = result.getTotalElements();

        List<Map<String, Object>> items = products.stream().map(p -> {
            Map<String, Object> row = new HashMap<>();
            row.put("_id", p.getId());
            row.put("name", p.getName());
            row.put("slug", p.getSlug());
            row.put("SKU", p.getSKU());
            row.put("brand", p.getBrand());
            row.put("sellerId", p.getSellerId());
            row.put("isActive", p.getIsActive());
            row.put("adminApproved", p.getAdminApproved());
            row.put("createdAt", p.getCreatedAt());
            return row;
        }).toList();

        return Map.of(
                "items", items,
                "total", total,
                "page", page,
                "pageSize", pageSize,
                "totalPages", totalPages(total, pageSize)
        );
    }

    public Product reviewSellerProduct(String productId, String action, String note, String actorUserId, HttpServletRequest request) {
        Product product = productRepository.findById(productId).orElseThrow(() -> new AppException("Product not found", 404, "PRODUCT_NOT_FOUND"));
        Map<String, Object> previous = Map.of(
                "adminApproved", bool(product.getAdminApproved()),
                "isActive", bool(product.getIsActive()),
                "adminReviewNote", str(product.getAdminReviewNote())
        );
        if ("APPROVE".equalsIgnoreCase(action)) {
            product.setAdminApproved(true);
            product.setIsActive(true);
        } else {
            product.setAdminApproved(false);
            product.setIsActive(false);
        }
        product.setAdminReviewNote(str(note));
        product.setUpdatedAt(Instant.now());
        Product saved = productRepository.save(product);

        auditLogService.createAuditLog(
                "APPROVE".equalsIgnoreCase(action) ? "PRODUCT_APPROVE" : "PRODUCT_REJECT",
                actorUserId,
                "PRODUCT",
                productId,
                previous,
                Map.of(
                        "adminApproved", bool(saved.getAdminApproved()),
                        "isActive", bool(saved.getIsActive()),
                        "adminReviewNote", str(saved.getAdminReviewNote())
                ),
                request
        );
        return saved;
    }

    public Map<String, Object> listBanners(Map<String, String> params) {
        int page = PaginationUtil.page(intVal(params.get("page"), 1));
        int pageSize = PaginationUtil.pageSize(intVal(params.get("pageSize"), 20));
        Page<Banner> result = bannerRepository.findAll(PageRequest.of(page - 1, pageSize, Sort.by(Sort.Order.asc("displayOrder"), Sort.Order.desc("createdAt"))));
        List<Banner> items = result.getContent();
        long total = result.getTotalElements();

        return Map.of(
                "data", items,
                "items", items,
                "total", total,
                "page", page,
                "pageSize", pageSize,
                "totalPages", totalPages(total, pageSize)
        );
    }

    public List<Banner> reorderBanners(List<String> bannerIds, String actorUserId, HttpServletRequest request) {
        List<Banner> rows = catalogAdminService.reorderBanners(bannerIds);
        auditLogService.createAuditLog(
                "BANNER_REORDER",
                actorUserId,
                "BANNER",
                "bulk",
                null,
                Map.of("bannerIds", bannerIds == null ? List.of() : bannerIds),
                request
        );
        return rows;
    }

    public Product updateLowStockThreshold(String productId, int threshold) {
        return catalogAdminService.updateLowStockThreshold(productId, threshold);
    }

    public Map<String, Object> getHomeFeaturedConfig() {
        HomeFeaturedConfig config = homeFeaturedConfigRepository.findByKey("HOME_FEATURED").orElse(null);
        List<HomeFeaturedConfig.HomeFeaturedItem> items = config == null || config.getItems() == null ? List.of() : config.getItems().stream()
                .filter(item -> item != null && !blank(item.getProductId()))
                .sorted(Comparator.comparing(item -> item.getDisplayOrder() == null ? 0 : item.getDisplayOrder()))
                .toList();
        return Map.of("key", "HOME_FEATURED", "items", items);
    }

    public Map<String, Object> upsertHomeFeaturedConfig(List<Map<String, Object>> rawItems) {
        List<HomeFeaturedConfig.HomeFeaturedItem> items = new ArrayList<>();
        for (Map<String, Object> row : rawItems == null ? List.<Map<String, Object>>of() : rawItems) {
            HomeFeaturedConfig.HomeFeaturedItem item = HomeFeaturedConfig.HomeFeaturedItem.builder()
                    .section(str(row.get("section")))
                    .productId(str(row.get("productId")))
                    .imageUrl(str(row.get("imageUrl")))
                    .displayOrder(intVal(row.get("displayOrder"), 0))
                    .isActive(row.get("isActive") == null || bool(row.get("isActive")))
                    .build();
            if (!blank(item.getProductId())) {
                items.add(item);
            }
        }
        items.sort(Comparator.comparing(row -> row.getDisplayOrder() == null ? 0 : row.getDisplayOrder()));

        HomeFeaturedConfig config = homeFeaturedConfigRepository.findByKey("HOME_FEATURED").orElse(new HomeFeaturedConfig());
        Instant now = Instant.now();
        if (config.getCreatedAt() == null) config.setCreatedAt(now);
        config.setKey("HOME_FEATURED");
        config.setItems(items);
        config.setUpdatedAt(now);
        HomeFeaturedConfig saved = homeFeaturedConfigRepository.save(config);
        return Map.of("key", "HOME_FEATURED", "items", saved.getItems() == null ? List.of() : saved.getItems());
    }

    public Map<String, Object> listAuditLogs(Map<String, String> params) {
        return auditLogService.listAuditLogs(intVal(params.get("page"), 1), intVal(params.get("pageSize"), 20));
    }

    private Summary ordersRevenueSummary(Instant fromDate, Instant toDate) {
        List<Order> rows = listOrdersByCreatedAt(fromDate, toDate);
        int orders = rows.size();
        double revenue = round2(rows.stream().mapToDouble(row -> row.getTotalAmount() == null ? 0 : row.getTotalAmount()).sum());
        return new Summary(orders, revenue);
    }

    private List<Order> listOrdersByCreatedAt(Instant fromDate, Instant toDate) {
        return orderRepository.findAll(createdAtSpec(fromDate, toDate), Sort.by(Sort.Direction.ASC, "createdAt"));
    }

    private Specification<Order> adminOrderSpec(Map<String, String> params) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (!blank(params.get("status"))) predicates.add(cb.equal(root.get("orderStatus"), params.get("status")));
            if (!blank(params.get("paymentStatus"))) predicates.add(cb.equal(root.get("paymentStatus"), params.get("paymentStatus")));
            if (!blank(params.get("sellerId"))) predicates.add(cb.equal(root.get("sellerId"), params.get("sellerId")));
            if (!blank(params.get("orderId"))) predicates.add(cb.equal(root.get("orderId"), params.get("orderId")));
            addCreatedAtPredicates(predicates, root, cb, parseInstant(params.get("fromDate"), false), parseInstant(params.get("toDate"), true));
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private Specification<User> adminUserSpec(Map<String, String> params) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (!blank(params.get("role"))) predicates.add(cb.equal(root.get("role"), params.get("role")));
            if (!blank(params.get("status"))) predicates.add(cb.equal(root.get("accountStatus"), params.get("status")));
            if (!blank(params.get("search"))) {
                String like = "%" + params.get("search").trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("email")), like)
                ));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private Specification<StockMovement> stockMovementSpec(Map<String, String> params) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (!blank(params.get("productId"))) predicates.add(cb.equal(root.get("productId"), params.get("productId")));
            if (!blank(params.get("variantId"))) predicates.add(cb.equal(root.get("variantId"), params.get("variantId")));
            if (!blank(params.get("reason"))) predicates.add(cb.equal(root.get("reason"), params.get("reason")));
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private Specification<Order> createdAtSpec(Instant fromDate, Instant toDate) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            addCreatedAtPredicates(predicates, root, cb, fromDate, toDate);
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private void addCreatedAtPredicates(
            List<jakarta.persistence.criteria.Predicate> predicates,
            jakarta.persistence.criteria.Root<?> root,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            Instant fromDate,
            Instant toDate
    ) {
        if (fromDate != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromDate));
        if (toDate != null) predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), toDate));
    }

    private List<Map<String, Object>> buildRevenueSeries(List<Order> rows) {
        Map<String, double[]> grouped = new TreeMap<>();
        for (Order row : rows) {
            if (row.getCreatedAt() == null) continue;
            LocalDate d = row.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
            String key = d.toString();
            double[] state = grouped.computeIfAbsent(key, k -> new double[]{0, 0});
            state[0] += row.getTotalAmount() == null ? 0 : row.getTotalAmount();
            state[1] += 1;
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<String, double[]> e : grouped.entrySet()) {
            LocalDate d = LocalDate.parse(e.getKey());
            out.add(Map.of(
                    "_id", Map.of("year", d.getYear(), "month", d.getMonthValue(), "day", d.getDayOfMonth()),
                    "revenue", round2(e.getValue()[0]),
                    "orders", (int) e.getValue()[1]
            ));
        }
        return out;
    }

    private List<Map<String, Object>> buildOrdersByStatus(List<Order> rows) {
        Map<String, Integer> grouped = new HashMap<>();
        for (Order row : rows) {
            String status = str(row.getOrderStatus());
            if (status.isBlank()) continue;
            grouped.put(status, grouped.getOrDefault(status, 0) + 1);
        }
        return grouped.entrySet().stream()
                .map(entry -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("_id", entry.getKey());
                    row.put("count", entry.getValue());
                    return row;
                })
                .sorted((a, b) -> Integer.compare((int) b.get("count"), (int) a.get("count")))
                .toList();
    }

    private List<Map<String, Object>> buildTopSellingProducts(List<Order> rows, int limit) {
        Map<String, TopProduct> grouped = new HashMap<>();
        for (Order row : rows) {
            for (Order.OrderItem item : row.getOrderItems() == null ? List.<Order.OrderItem>of() : row.getOrderItems()) {
                String productId = str(item.getProductId());
                if (productId.isBlank()) continue;
                TopProduct state = grouped.getOrDefault(productId, new TopProduct(productId, item.getProductName(), 0, 0));
                state.totalUnitsSold += item.getQuantity() == null ? 0 : item.getQuantity();
                state.totalRevenue += item.getLineTotal() == null ? 0 : item.getLineTotal();
                grouped.put(productId, state);
            }
        }
        return grouped.values().stream()
                .sorted((a, b) -> Integer.compare(b.totalUnitsSold, a.totalUnitsSold))
                .limit(limit)
                .map(row -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("_id", row.productId);
                    item.put("productName", str(row.productName));
                    item.put("totalUnitsSold", row.totalUnitsSold);
                    item.put("totalRevenue", round2(row.totalRevenue));
                    return item;
                })
                .toList();
    }

    private List<Map<String, Object>> buildRecentOrders(List<Order> rows, int limit) {
        return rows.stream()
                .sorted((a, b) -> compareInstantDesc(a.getCreatedAt(), b.getCreatedAt()))
                .limit(limit)
                .map(row -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("orderId", row.getOrderId());
                    m.put("userId", row.getUserId());
                    m.put("totalAmount", row.getTotalAmount());
                    m.put("orderStatus", row.getOrderStatus());
                    m.put("createdAt", row.getCreatedAt());
                    return m;
                })
                .toList();
    }

    private int compareInstantDesc(Instant a, Instant b) {
        Instant aa = a == null ? Instant.EPOCH : a;
        Instant bb = b == null ? Instant.EPOCH : b;
        return bb.compareTo(aa);
    }

    private Map<String, Object> pagedRows(List<Object> rows, Instant updatedAt, String source) {
        return Map.of(
                "data", rows,
                "items", rows,
                "total", rows.size(),
                "page", 1,
                "pageSize", rows.size(),
                "totalPages", 1,
                "updatedAt", updatedAt,
                "source", source
        );
    }

    private int totalPages(long total, int pageSize) {
        return Math.max(1, (int) Math.ceil(total / (double) pageSize));
    }

    @SuppressWarnings("unchecked")
    private List<Object> castList(Object value) {
        if (value instanceof List<?> list) {
            return (List<Object>) list;
        }
        return new ArrayList<>();
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private boolean blank(String value) {
        return value == null || value.trim().isBlank();
    }

    private boolean bool(Object v) {
        if (v instanceof Boolean b) return b;
        return "true".equalsIgnoreCase(str(v)) || "1".equals(str(v));
    }

    private int intVal(Object v, int def) {
        try {
            return Integer.parseInt(str(v));
        } catch (Exception ignored) {
            return def;
        }
    }

    private Instant parseInstant(String raw, boolean endOfDay) {
        if (blank(raw)) return null;
        String s = raw.trim();
        try {
            if (s.length() == 10) {
                LocalDate d = LocalDate.parse(s);
                return endOfDay
                        ? d.plusDays(1).atStartOfDay().minusNanos(1).toInstant(ZoneOffset.UTC)
                        : d.atStartOfDay().toInstant(ZoneOffset.UTC);
            }
            return Instant.parse(s);
        } catch (Exception ex) {
            try {
                return java.time.OffsetDateTime.parse(s).toInstant();
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private record Summary(int orders, double revenue) {
    }

    private static class TopProduct {
        private final String productId;
        private final String productName;
        private int totalUnitsSold;
        private double totalRevenue;

        private TopProduct(String productId, String productName, int totalUnitsSold, double totalRevenue) {
            this.productId = productId;
            this.productName = productName;
            this.totalUnitsSold = totalUnitsSold;
            this.totalRevenue = totalRevenue;
        }
    }
}
