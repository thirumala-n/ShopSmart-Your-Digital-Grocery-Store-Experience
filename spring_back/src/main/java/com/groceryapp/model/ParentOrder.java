package com.groceryapp.model;

import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
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
@Table(name = "parent_orders")
public class ParentOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    @Column(unique = true)
    private String orderGroupId;
    private String userId;
    @ElementCollection
    @CollectionTable(name = "parent_order_child_order_ids", joinColumns = @JoinColumn(name = "parent_order_id"))
    @Builder.Default
    private List<String> childOrderIds = new ArrayList<>();
    @ElementCollection
    @CollectionTable(name = "parent_order_child_summaries", joinColumns = @JoinColumn(name = "parent_order_id"))
    @Builder.Default
    private List<ChildSummary> childSummaries = new ArrayList<>();
    private String aggregateOrderStatus;
    private String aggregatePaymentStatus;
    private String paymentMethod;
    @Embedded
    private Order.Address shippingAddress;
    @Embedded
    private Order.DeliverySlotInfo deliverySlot;
    private Boolean deliverySlotReleased;
    private Double totalMRP;
    private Double totalDiscount;
    private String couponCode;
    private Double couponDiscount;
    private Double deliveryFee;
    private Double tax;
    private Double totalAmount;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Embeddable
    public static class ChildSummary {
        private String orderId;
        private String sellerId;
        private String orderStatus;
        private String paymentStatus;
        private Double totalAmount;
    }
}
