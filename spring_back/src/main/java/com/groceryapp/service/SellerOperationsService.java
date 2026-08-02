package com.groceryapp.service;

import com.groceryapp.exception.AppException;
import com.groceryapp.model.Order;
import com.groceryapp.model.Product;
import com.groceryapp.model.StockMovement;
import com.groceryapp.repository.OrderRepository;
import com.groceryapp.repository.ProductRepository;
import com.groceryapp.repository.StockMovementRepository;
import com.groceryapp.util.CsvUtil;
import com.groceryapp.util.PaginationUtil;
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
public class SellerOperationsService {
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;

    public SellerOperationsService(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            StockMovementRepository stockMovementRepository
    ) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
    }

    public Map<String, Object> listSellerOrders(String sellerId, String status, Integer pageRaw, Integer pageSizeRaw) {
        int page = PaginationUtil.page(pageRaw);
        int pageSize = PaginationUtil.pageSize(pageSizeRaw);
        Page<Order> result = orderRepository.findAll(
                sellerOrderSpec(sellerId, status, null, null),
                PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        List<Order> items = result.getContent();
        long total = result.getTotalElements();

        return Map.of(
                "items", items,
                "total", total,
                "page", page,
                "pageSize", pageSize,
                "totalPages", Math.max(1, (int) Math.ceil(total / (double) pageSize))
        );
    }

    public Order getSellerOrderByOrderId(String sellerId, String orderId) {
        return orderRepository.findAll((root, query, cb) -> cb.and(
                        cb.equal(root.get("orderId"), orderId),
                        cb.equal(root.get("sellerId"), sellerId)
                )).stream()
                .findFirst()
                .orElseThrow(() -> new AppException("Order not found", 404, "ORDER_NOT_FOUND"));
    }

    public Map<String, Object> getSellerDashboard(String sellerId) {
        Instant todayStart = LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant yesterdayStart = todayStart.minusSeconds(24L * 60 * 60);

        Summary today = sellerSummaryStats(sellerId, todayStart, null);
        long pendingOrders = countOrdersByStatusIn(sellerId, List.of("CONFIRMED", "PROCESSING", "PACKED"));
        List<Map<String, Object>> lowStock = sellerLowStockVariants(sellerId);
        List<Map<String, Object>> revenueSeries = revenueSeriesForSeller(sellerId, LocalDate.now(ZoneOffset.UTC).minusDays(29).atStartOfDay().toInstant(ZoneOffset.UTC), null);
        List<Map<String, Object>> topProducts = topSellingProductsBySeller(sellerId, 5, null, null);
        List<Map<String, Object>> recentOrders = recentOrdersBySeller(sellerId, 10);
        Summary yesterday = sellerSummaryStats(sellerId, yesterdayStart, todayStart);

        double revenueDeltaPct = yesterday.totalRevenue == 0
                ? 100
                : round2(((today.totalRevenue - yesterday.totalRevenue) / yesterday.totalRevenue) * 100);

        return Map.of(
                "metrics", Map.of(
                        "todayRevenue", today.totalRevenue,
                        "todayOrders", today.totalOrders,
                        "lowStockCount", lowStock.size(),
                        "pendingOrders", pendingOrders,
                        "revenueDeltaPct", revenueDeltaPct
                ),
                "revenueSeries", revenueSeries,
                "topProducts", topProducts,
                "recentOrders", recentOrders
        );
    }

    public Map<String, Object> getSellerAnalytics(String sellerId, String fromDateRaw, String toDateRaw) {
        DateRange range = parseDateRange(fromDateRaw, toDateRaw);
        Summary summary = sellerSummaryStats(sellerId, range.fromDate, range.toDate);
        List<Map<String, Object>> revenueSeries = revenueSeriesForSeller(
                sellerId,
                range.fromDate == null && range.toDate == null
                        ? LocalDate.now(ZoneOffset.UTC).minusDays(29).atStartOfDay().toInstant(ZoneOffset.UTC)
                        : range.fromDate,
                range.toDate
        );
        List<Map<String, Object>> topProducts = topSellingProductsBySeller(sellerId, 20, range.fromDate, range.toDate);
        double fulfillmentRate = summary.shippedCount == 0
                ? 0
                : round2((summary.deliveredCount / (double) summary.shippedCount) * 100);

        return Map.of(
                "revenueSeries", revenueSeries,
                "topProducts", topProducts,
                "fulfillmentRate", fulfillmentRate,
                "totalOrders", summary.totalOrders,
                "totalRevenue", summary.totalRevenue
        );
    }

    public String exportSellerSalesCsv(String sellerId, String fromDateRaw, String toDateRaw) {
        Map<String, Object> analytics = getSellerAnalytics(sellerId, fromDateRaw, toDateRaw);
        List<Map<String, Object>> revenueSeries = castMapList(analytics.get("revenueSeries"));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> item : revenueSeries) {
            Map<String, Object> id = castMap(item.get("_id"));
            String date = intVal(id.get("year"), 0) + "-"
                    + String.format("%02d", intVal(id.get("month"), 0)) + "-"
                    + String.format("%02d", intVal(id.get("day"), 0));
            rows.add(Map.of(
                    "date", date,
                    "revenue", num(item.get("revenue"), 0),
                    "orders", intVal(item.get("orders"), 0)
            ));
        }
        return CsvUtil.toCsv(List.of("date", "revenue", "orders"), rows);
    }

    public Map<String, Object> listSellerStockMovements(String sellerId, Integer pageRaw, Integer pageSizeRaw) {
        int page = PaginationUtil.page(pageRaw);
        int pageSize = PaginationUtil.pageSize(pageSizeRaw);
        long skip = PaginationUtil.skip(page, pageSize);

        List<Product> products = productRepository.findBySellerId(sellerId);
        Set<String> productIds = new HashSet<>(products.stream().map(Product::getId).toList());
        if (productIds.isEmpty()) {
            return Map.of("items", List.of(), "total", 0, "page", page, "pageSize", pageSize, "totalPages", 1);
        }

        Page<StockMovement> result = stockMovementRepository.findAll(
                (root, query, cb) -> root.get("productId").in(productIds),
                PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        List<StockMovement> rows = result.getContent();
        long total = result.getTotalElements();

        Map<String, Product> productMap = new HashMap<>();
        for (Product p : products) productMap.put(p.getId(), p);
        List<Map<String, Object>> items = rows.stream().map(row -> {
            Product p = productMap.get(row.getProductId());
            Map<String, Object> m = new HashMap<>();
            m.put("_id", row.getId());
            m.put("productId", row.getProductId());
            m.put("variantId", row.getVariantId());
            m.put("delta", row.getDelta());
            m.put("reason", row.getReason());
            m.put("referenceOrderId", row.getReferenceOrderId());
            m.put("performedBy", row.getPerformedBy());
            m.put("createdAt", row.getCreatedAt());
            m.put("productName", p == null ? "" : p.getName());
            m.put("productSKU", p == null ? "" : p.getSKU());
            return m;
        }).toList();

        return Map.of(
                "items", items,
                "total", total,
                "page", page,
                "pageSize", pageSize,
                "totalPages", Math.max(1, (int) Math.ceil(total / (double) pageSize))
        );
    }

    private Summary sellerSummaryStats(String sellerId, Instant fromDate, Instant toDate) {
        List<Order> rows = listOrdersBySeller(sellerId, fromDate, toDate);
        double totalRevenue = round2(rows.stream().mapToDouble(order -> order.getTotalAmount() == null ? 0 : order.getTotalAmount()).sum());
        int totalOrders = rows.size();
        int deliveredCount = (int) rows.stream().filter(order -> "DELIVERED".equals(order.getOrderStatus())).count();
        int shippedCount = (int) rows.stream().filter(order ->
                List.of("SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED").contains(order.getOrderStatus())
        ).count();
        return new Summary(totalRevenue, totalOrders, deliveredCount, shippedCount);
    }

    private long countOrdersByStatusIn(String sellerId, List<String> statuses) {
        return orderRepository.count((root, query, cb) -> cb.and(
                cb.equal(root.get("sellerId"), sellerId),
                root.get("orderStatus").in(statuses)
        ));
    }

    private List<Map<String, Object>> sellerLowStockVariants(String sellerId) {
        List<Product> products = productRepository.findBySellerId(sellerId);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Product product : products) {
            int threshold = product.getLowStockThreshold() == null ? 10 : product.getLowStockThreshold();
            for (Product.Variant variant : product.getVariants() == null ? List.<Product.Variant>of() : product.getVariants()) {
                int stock = variant.getStock() == null ? 0 : variant.getStock();
                if (stock < threshold) {
                    rows.add(Map.of(
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
        return rows;
    }

    private List<Map<String, Object>> revenueSeriesForSeller(String sellerId, Instant fromDate, Instant toDate) {
        List<Order> rows = listOrdersBySeller(sellerId, fromDate, toDate);
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

    private List<Map<String, Object>> topSellingProductsBySeller(String sellerId, int limit, Instant fromDate, Instant toDate) {
        List<Order> rows = listOrdersBySeller(sellerId, fromDate, toDate);
        Map<String, ProductAgg> grouped = new HashMap<>();
        for (Order row : rows) {
            for (Order.OrderItem item : row.getOrderItems() == null ? List.<Order.OrderItem>of() : row.getOrderItems()) {
                String productId = str(item.getProductId());
                if (productId.isBlank()) continue;
                ProductAgg agg = grouped.getOrDefault(productId, new ProductAgg(productId, item.getProductName(), 0, 0));
                agg.totalUnitsSold += item.getQuantity() == null ? 0 : item.getQuantity();
                agg.totalRevenue += item.getLineTotal() == null ? 0 : item.getLineTotal();
                grouped.put(productId, agg);
            }
        }
        return grouped.values().stream()
                .sorted((a, b) -> Integer.compare(b.totalUnitsSold, a.totalUnitsSold))
                .limit(limit)
                .map(agg -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("_id", agg.productId);
                    row.put("productName", agg.productName);
                    row.put("totalUnitsSold", agg.totalUnitsSold);
                    row.put("totalRevenue", round2(agg.totalRevenue));
                    return row;
                })
                .toList();
    }

    private List<Map<String, Object>> recentOrdersBySeller(String sellerId, int limit) {
        List<Order> rows = orderRepository.findAll(
                (root, query, cb) -> cb.equal(root.get("sellerId"), sellerId),
                PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();
        return rows.stream().map(order -> {
            Map<String, Object> m = new HashMap<>();
            m.put("orderId", order.getOrderId());
            m.put("userId", order.getUserId());
            m.put("totalAmount", order.getTotalAmount());
            m.put("orderStatus", order.getOrderStatus());
            m.put("createdAt", order.getCreatedAt());
            m.put("deliverySlot", order.getDeliverySlot());
            m.put("shippingAddress", order.getShippingAddress());
            m.put("orderItems", order.getOrderItems());
            return m;
        }).toList();
    }

    private List<Order> listOrdersBySeller(String sellerId, Instant fromDate, Instant toDate) {
        return orderRepository.findAll(sellerOrderSpec(sellerId, null, fromDate, toDate));
    }

    private Specification<Order> sellerOrderSpec(String sellerId, String status, Instant fromDate, Instant toDate) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("sellerId"), sellerId));
            if (!blank(status)) predicates.add(cb.equal(root.get("orderStatus"), status));
            if (fromDate != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromDate));
            if (toDate != null) predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), toDate));
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private DateRange parseDateRange(String fromDateRaw, String toDateRaw) {
        Instant fromDate = parseDate(fromDateRaw, false, "INVALID_FROM_DATE");
        Instant toDate = parseDate(toDateRaw, true, "INVALID_TO_DATE");
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new AppException("fromDate must be before or equal to toDate", 400, "INVALID_DATE_RANGE");
        }
        return new DateRange(fromDate, toDate);
    }

    private Instant parseDate(String raw, boolean endOfDay, String code) {
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
                throw new AppException(endOfDay ? "Invalid toDate" : "Invalid fromDate", 400, code);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castMapList(Object value) {
        if (value instanceof List<?> rows) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object row : rows) {
                if (row instanceof Map<?, ?> mapAny) {
                    Map<String, Object> map = new HashMap<>();
                    for (Map.Entry<?, ?> e : mapAny.entrySet()) map.put(String.valueOf(e.getKey()), e.getValue());
                    out.add(map);
                }
            }
            return out;
        }
        return new ArrayList<>();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Object value) {
        if (value instanceof Map<?, ?> mapAny) {
            Map<String, Object> map = new HashMap<>();
            for (Map.Entry<?, ?> e : mapAny.entrySet()) map.put(String.valueOf(e.getKey()), e.getValue());
            return map;
        }
        return new HashMap<>();
    }

    private boolean blank(String value) {
        return value == null || value.trim().isBlank();
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private int intVal(Object value, int def) {
        try {
            return Integer.parseInt(str(value));
        } catch (Exception ignored) {
            return def;
        }
    }

    private double num(Object value, double def) {
        try {
            return value == null ? def : Double.parseDouble(String.valueOf(value));
        } catch (Exception ignored) {
            return def;
        }
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private record DateRange(Instant fromDate, Instant toDate) {
    }

    private static class Summary {
        private final double totalRevenue;
        private final int totalOrders;
        private final int deliveredCount;
        private final int shippedCount;

        private Summary(double totalRevenue, int totalOrders, int deliveredCount, int shippedCount) {
            this.totalRevenue = totalRevenue;
            this.totalOrders = totalOrders;
            this.deliveredCount = deliveredCount;
            this.shippedCount = shippedCount;
        }
    }

    private static class ProductAgg {
        private final String productId;
        private final String productName;
        private int totalUnitsSold;
        private double totalRevenue;

        private ProductAgg(String productId, String productName, int totalUnitsSold, double totalRevenue) {
            this.productId = productId;
            this.productName = productName;
            this.totalUnitsSold = totalUnitsSold;
            this.totalRevenue = totalRevenue;
        }
    }
}
