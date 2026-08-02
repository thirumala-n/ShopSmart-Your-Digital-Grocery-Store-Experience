package com.groceryapp.util;

import com.groceryapp.exception.AppException;

import java.util.List;
import java.util.Map;

public final class OrderTransitions {
    private static final Map<String, List<String>> ALLOWED = Map.of(
            OrderStatus.PENDING_PAYMENT, List.of(OrderStatus.CONFIRMED, OrderStatus.CANCELLED),
            OrderStatus.CONFIRMED, List.of(OrderStatus.PROCESSING, OrderStatus.CANCELLED),
            OrderStatus.PROCESSING, List.of(OrderStatus.PACKED, OrderStatus.CANCELLED),
            OrderStatus.PACKED, List.of(OrderStatus.SHIPPED),
            OrderStatus.SHIPPED, List.of(OrderStatus.OUT_FOR_DELIVERY),
            OrderStatus.OUT_FOR_DELIVERY, List.of(OrderStatus.DELIVERED),
            OrderStatus.DELIVERED, List.of(),
            OrderStatus.CANCELLED, List.of(OrderStatus.REFUND_INITIATED),
            OrderStatus.REFUND_INITIATED, List.of(OrderStatus.REFUNDED),
            OrderStatus.REFUNDED, List.of()
    );

    private OrderTransitions() {
    }

    public static boolean canTransition(String currentStatus, String nextStatus, String paymentStatus) {
        List<String> next = ALLOWED.getOrDefault(currentStatus, List.of());
        if (!next.contains(nextStatus)) {
            return false;
        }
        return !(OrderStatus.CANCELLED.equals(currentStatus)
                && OrderStatus.REFUND_INITIATED.equals(nextStatus)
                && !PaymentStatus.PAID.equals(paymentStatus));
    }

    public static void assertTransition(String currentStatus, String nextStatus, String paymentStatus) {
        if (!canTransition(currentStatus, nextStatus, paymentStatus)) {
            throw new AppException("Invalid order status transition: " + currentStatus + " -> " + nextStatus, 400, "INVALID_ORDER_TRANSITION");
        }
    }
}
