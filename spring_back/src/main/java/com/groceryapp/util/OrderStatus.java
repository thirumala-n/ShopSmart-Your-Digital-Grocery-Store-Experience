package com.groceryapp.util;

public final class OrderStatus {
    public static final String PENDING_PAYMENT = "PENDING_PAYMENT";
    public static final String CONFIRMED = "CONFIRMED";
    public static final String PROCESSING = "PROCESSING";
    public static final String PACKED = "PACKED";
    public static final String SHIPPED = "SHIPPED";
    public static final String OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY";
    public static final String DELIVERED = "DELIVERED";
    public static final String CANCELLED = "CANCELLED";
    public static final String REFUND_INITIATED = "REFUND_INITIATED";
    public static final String REFUNDED = "REFUNDED";

    private OrderStatus() {
    }
}
