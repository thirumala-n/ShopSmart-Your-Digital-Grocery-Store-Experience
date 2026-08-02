package com.groceryapp.util;

public final class PaymentStatus {
    public static final String PENDING = "PENDING";
    public static final String PAID = "PAID";
    public static final String REFUND_INITIATED = "REFUND_INITIATED";
    public static final String REFUNDED = "REFUNDED";

    private PaymentStatus() {
    }
}
