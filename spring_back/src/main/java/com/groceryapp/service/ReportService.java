package com.groceryapp.service;

import com.groceryapp.model.Order;
import com.groceryapp.model.Product;
import com.groceryapp.model.User;
import com.groceryapp.repository.OrderRepository;
import com.groceryapp.repository.ProductRepository;
import com.groceryapp.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class ReportService {
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public ReportService(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            UserRepository userRepository
    ) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    public Map<String, Object> getSalesReport(String fromDateRaw, String toDateRaw) {
        DateRange range = parseDateRange(fromDateRaw, toDateRaw);
        List<Order> orders = findOrders(range.fromDate, range.toDate);

        int totalOrders = orders.size();
        double totalRevenue = round2(orders.stream().mapToDouble(order -> order.getTotalAmount() == null ? 0 : order.getTotalAmount()).sum());
        int totalUnits = orders.stream()
                .flatMap(order -> (order.getOrderItems() == null ? List.<Order.OrderItem>of() : order.getOrderItems()).stream())
                .mapToInt(item -> item.getQuantity() == null ? 0 : item.getQuantity())
                .sum();

        Map<String, SellerAgg> bySellerMap = new HashMap<>();
        for (Order order : orders) {
            String sellerId = str(order.getSellerId());
            SellerAgg agg = bySellerMap.getOrDefault(sellerId, new SellerAgg(sellerId, 0, 0));
            agg.totalOrders += 1;
            agg.totalRevenue += order.getTotalAmount() == null ? 0 : order.getTotalAmount();
            bySellerMap.put(sellerId, agg);
        }
        List<Map<String, Object>> bySeller = bySellerMap.values().stream()
                .sorted((a, b) -> Double.compare(b.totalRevenue, a.totalRevenue))
                .map(agg -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("_id", agg.sellerId);
                    row.put("totalOrders", agg.totalOrders);
                    row.put("totalRevenue", round2(agg.totalRevenue));
                    return row;
                })
                .toList();

        return Map.of(
                "totalOrders", totalOrders,
                "totalRevenue", totalRevenue,
                "totalUnits", totalUnits,
                "averageOrderValue", totalOrders == 0 ? 0 : round2(totalRevenue / totalOrders),
                "bySeller", bySeller
        );
    }

    public List<Map<String, Object>> getProductPerformanceReport() {
        List<Product> rows = productRepository.findAll(PageRequest.of(0, 1000, Sort.by(Sort.Direction.DESC, "salesCount"))).getContent();
        return rows.stream().map(row -> {
            Map<String, Object> out = new HashMap<>();
            out.put("productId", row.getId());
            out.put("name", row.getName());
            out.put("sku", row.getSKU());
            out.put("totalUnitsSold", row.getSalesCount() == null ? 0 : row.getSalesCount());
            out.put("totalRevenue", 0);
            out.put("averageRating", row.getRating() == null ? 0 : row.getRating());
            out.put("returnRate", 0);
            return out;
        }).toList();
    }

    public Map<String, Object> getCustomerGrowthReport(String fromDateRaw, String toDateRaw) {
        DateRange range = parseDateRange(fromDateRaw, toDateRaw);
        List<User> users = findUsers(range.fromDate, range.toDate);
        List<Order> orders = orderRepository.findAll();

        Map<String, Integer> registrationsMap = new TreeMap<>();
        for (User user : users) {
            if (user.getCreatedAt() == null) continue;
            LocalDate d = user.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
            registrationsMap.put(d.toString(), registrationsMap.getOrDefault(d.toString(), 0) + 1);
        }
        List<Map<String, Object>> registrations = new ArrayList<>();
        for (Map.Entry<String, Integer> e : registrationsMap.entrySet()) {
            LocalDate d = LocalDate.parse(e.getKey());
            registrations.add(Map.of(
                    "_id", Map.of("year", d.getYear(), "month", d.getMonthValue(), "day", d.getDayOfMonth()),
                    "count", e.getValue()
            ));
        }

        Map<String, UserOrderAgg> repeatMap = new HashMap<>();
        for (Order order : orders) {
            String userId = str(order.getUserId());
            UserOrderAgg agg = repeatMap.getOrDefault(userId, new UserOrderAgg(userId, 0, 0));
            agg.ordersCount += 1;
            agg.totalSpend += order.getTotalAmount() == null ? 0 : order.getTotalAmount();
            repeatMap.put(userId, agg);
        }
        int repeatCount = (int) repeatMap.values().stream().filter(agg -> agg.ordersCount > 1).count();
        List<Map<String, Object>> topCustomers = repeatMap.values().stream()
                .sorted((a, b) -> Double.compare(b.totalSpend, a.totalSpend))
                .limit(10)
                .map(agg -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("_id", agg.userId);
                    row.put("ordersCount", agg.ordersCount);
                    row.put("totalSpend", round2(agg.totalSpend));
                    return row;
                })
                .toList();
        int totalActiveUsers = repeatMap.size();
        double repeatPurchaseRate = totalActiveUsers == 0 ? 0 : round2((repeatCount / (double) totalActiveUsers) * 100);
        double averageOrdersPerUser = totalActiveUsers == 0
                ? 0
                : round2(repeatMap.values().stream().mapToInt(agg -> agg.ordersCount).sum() / (double) totalActiveUsers);

        return Map.of(
                "registrations", registrations,
                "totalActiveUsers", totalActiveUsers,
                "repeatPurchaseRate", repeatPurchaseRate,
                "averageOrdersPerUser", averageOrdersPerUser,
                "topCustomers", topCustomers
        );
    }

    public Map<String, Object> getRevenueReport(String fromDateRaw, String toDateRaw) {
        DateRange range = parseDateRange(fromDateRaw, toDateRaw);
        List<Order> orders = findOrders(range.fromDate, range.toDate);

        Map<String, Double> dailyMap = new TreeMap<>();
        for (Order order : orders) {
            if (order.getCreatedAt() == null) continue;
            LocalDate d = order.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
            dailyMap.put(d.toString(), dailyMap.getOrDefault(d.toString(), 0d) + (order.getTotalAmount() == null ? 0 : order.getTotalAmount()));
        }
        List<Map<String, Object>> daily = new ArrayList<>();
        double cumulative = 0;
        List<Map<String, Object>> cumulativeSeries = new ArrayList<>();
        for (Map.Entry<String, Double> e : dailyMap.entrySet()) {
            LocalDate d = LocalDate.parse(e.getKey());
            double revenue = round2(e.getValue());
            cumulative = round2(cumulative + revenue);
            Map<String, Object> dailyItem = Map.of(
                    "_id", Map.of("year", d.getYear(), "month", d.getMonthValue(), "day", d.getDayOfMonth()),
                    "revenue", revenue
            );
            daily.add(dailyItem);
            Map<String, Object> cumulativeItem = new HashMap<>(dailyItem);
            cumulativeItem.put("cumulativeRevenue", cumulative);
            cumulativeSeries.add(cumulativeItem);
        }

        Map<String, PaymentAgg> byPayment = new HashMap<>();
        double refundAmount = 0;
        for (Order order : orders) {
            String method = str(order.getPaymentMethod());
            PaymentAgg agg = byPayment.getOrDefault(method, new PaymentAgg(method, 0, 0));
            agg.revenue += order.getTotalAmount() == null ? 0 : order.getTotalAmount();
            agg.orders += 1;
            byPayment.put(method, agg);
            if ("REFUNDED".equals(order.getPaymentStatus())) {
                refundAmount += order.getTotalAmount() == null ? 0 : order.getTotalAmount();
            }
        }
        List<Map<String, Object>> revenueByPaymentMethod = byPayment.values().stream()
                .sorted((a, b) -> Double.compare(b.revenue, a.revenue))
                .map(agg -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("_id", agg.paymentMethod);
                    row.put("revenue", round2(agg.revenue));
                    row.put("orders", agg.orders);
                    return row;
                })
                .toList();

        return Map.of(
                "dailyRevenueSeries", daily,
                "cumulativeRevenueSeries", cumulativeSeries,
                "revenueByPaymentMethod", revenueByPaymentMethod,
                "refundAmount", round2(refundAmount)
        );
    }

    private List<Order> findOrders(Instant fromDate, Instant toDate) {
        return orderRepository.findAll(createdAtSpec(fromDate, toDate));
    }

    private List<User> findUsers(Instant fromDate, Instant toDate) {
        return userRepository.findAll(userCreatedAtSpec(fromDate, toDate));
    }

    private Specification<Order> createdAtSpec(Instant fromDate, Instant toDate) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (fromDate != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromDate));
            if (toDate != null) predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), toDate));
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private Specification<User> userCreatedAtSpec(Instant fromDate, Instant toDate) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (fromDate != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromDate));
            if (toDate != null) predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), toDate));
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private DateRange parseDateRange(String fromDateRaw, String toDateRaw) {
        Instant fromDate = parseInstant(fromDateRaw, false);
        Instant toDate = parseInstant(toDateRaw, true);
        return new DateRange(fromDate, toDate);
    }

    private Instant parseInstant(String raw, boolean endOfDay) {
        if (raw == null || raw.trim().isBlank()) return null;
        String value = raw.trim();
        try {
            if (value.length() == 10) {
                LocalDate d = LocalDate.parse(value);
                return endOfDay
                        ? d.plusDays(1).atStartOfDay().minusNanos(1).toInstant(ZoneOffset.UTC)
                        : d.atStartOfDay().toInstant(ZoneOffset.UTC);
            }
            return Instant.parse(value);
        } catch (Exception ex) {
            try {
                return java.time.OffsetDateTime.parse(value).toInstant();
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private record DateRange(Instant fromDate, Instant toDate) {
    }

    private static class SellerAgg {
        private final String sellerId;
        private int totalOrders;
        private double totalRevenue;

        private SellerAgg(String sellerId, int totalOrders, double totalRevenue) {
            this.sellerId = sellerId;
            this.totalOrders = totalOrders;
            this.totalRevenue = totalRevenue;
        }
    }

    private static class UserOrderAgg {
        private final String userId;
        private int ordersCount;
        private double totalSpend;

        private UserOrderAgg(String userId, int ordersCount, double totalSpend) {
            this.userId = userId;
            this.ordersCount = ordersCount;
            this.totalSpend = totalSpend;
        }
    }

    private static class PaymentAgg {
        private final String paymentMethod;
        private double revenue;
        private int orders;

        private PaymentAgg(String paymentMethod, double revenue, int orders) {
            this.paymentMethod = paymentMethod;
            this.revenue = revenue;
            this.orders = orders;
        }
    }
}
