package com.groceryapp.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    @Column(unique = true)
    private String orderId;
    @Column(name = "order_group_id")
    private String orderGroupId;
    @Column(name = "user_id")
    private String userId;
    @Column(name = "seller_id")
    private String sellerId;
    @ElementCollection
    @CollectionTable(name = "order_items", joinColumns = @JoinColumn(name = "order_id"))
    @Builder.Default
    private List<OrderItem> orderItems = new ArrayList<>();
    @Embedded
    private Address shippingAddress;
    @Embedded
    private DeliverySlotInfo deliverySlot;
    private String paymentMethod;
    @Column(name = "payment_status")
    private String paymentStatus;
    private String paymentGatewayOrderId;
    private String paymentGatewayPaymentId;
    private String refundReferenceId;
    @Column(name = "order_status")
    private String orderStatus;
    @ElementCollection
    @CollectionTable(name = "order_status_history", joinColumns = @JoinColumn(name = "order_id"))
    @Builder.Default
    private List<StatusHistory> statusHistory = new ArrayList<>();
    private String trackingId;
    private Double totalMRP;
    private Double totalDiscount;
    private String couponCode;
    private Double couponDiscount;
    private Double deliveryFee;
    private Double tax;
    private Double totalAmount;
    private String deliveryOTP;
    private Instant deliveryOTPExpiry;
    private Integer otpAttemptCount;
    private Instant otpLockedUntil;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Embeddable
    public static class StatusHistory {
        private String status;
        private Instant timestamp;
        private String note;
        private String updatedBy;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Embeddable
    public static class OrderItem {
        private String productId;
        private String variantId;
        private String productName;
        private String variantLabel;
        private Integer quantity;
        private Double unitPrice;
        private Double unitMRP;
        private Double lineTotal;
        private String sellerName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Embeddable
    public static class Address {
        private String label;
        private String fullName;
        private String phone;
        private String line1;
        private String line2;
        private String city;
        private String state;
        private String pincode;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Embeddable
    public static class DeliverySlotInfo {
        private Instant date;
        private String timeWindow;
    }
}
