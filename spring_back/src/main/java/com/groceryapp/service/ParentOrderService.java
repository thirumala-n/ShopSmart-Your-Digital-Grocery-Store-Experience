package com.groceryapp.service;

import com.groceryapp.exception.AppException;
import com.groceryapp.model.Order;
import com.groceryapp.model.ParentOrder;
import com.groceryapp.repository.OrderRepository;
import com.groceryapp.repository.ParentOrderRepository;
import com.groceryapp.util.Roles;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ParentOrderService {
    private final ParentOrderRepository parentOrderRepository;
    private final OrderRepository orderRepository;

    public ParentOrderService(ParentOrderRepository parentOrderRepository, OrderRepository orderRepository) {
        this.parentOrderRepository = parentOrderRepository;
        this.orderRepository = orderRepository;
    }

    public ParentOrder createFromChildOrders(String orderGroupId, String userId, Order.Address shippingAddress, Order.DeliverySlotInfo deliverySlot, String paymentMethod, String couponCode) {
        List<Order> children = orderRepository.findByOrderGroupIdOrderByCreatedAtAsc(orderGroupId);
        if (children.isEmpty()) {
            throw new AppException("No child orders found for group", 404, "ORDER_GROUP_NOT_FOUND");
        }
        ParentOrder parent = ParentOrder.builder()
                .orderGroupId(orderGroupId)
                .userId(userId)
                .paymentMethod(paymentMethod)
                .shippingAddress(shippingAddress)
                .deliverySlot(deliverySlot)
                .deliverySlotReleased(false)
                .couponCode(couponCode == null ? "" : couponCode)
                .build();
        applyAggregates(parent, children);
        return parentOrderRepository.save(parent);
    }

    public ParentOrder refreshAggregateForGroup(String orderGroupId) {
        ParentOrder parent = parentOrderRepository.findByOrderGroupId(orderGroupId)
                .orElseThrow(() -> new AppException("Parent order group not found", 404, "ORDER_GROUP_NOT_FOUND"));
        List<Order> children = orderRepository.findByOrderGroupIdOrderByCreatedAtAsc(orderGroupId);
        if (children.isEmpty()) {
            throw new AppException("No child orders found for group", 404, "ORDER_GROUP_NOT_FOUND");
        }
        applyAggregates(parent, children);
        return parentOrderRepository.save(parent);
    }

    public Map<String, Object> getOrderGroupForUser(String orderGroupId, String userId, String role) {
        ParentOrder parent = parentOrderRepository.findByOrderGroupId(orderGroupId)
                .orElseThrow(() -> new AppException("Order group not found", 404, "ORDER_GROUP_NOT_FOUND"));
        List<Order> children = orderRepository.findByOrderGroupIdOrderByCreatedAtAsc(orderGroupId);
        boolean isAdmin = Roles.ADMIN.equalsIgnoreCase(role);
        boolean isOwner = Objects.equals(parent.getUserId(), userId);
        boolean isSeller = Roles.SELLER.equalsIgnoreCase(role) && children.stream().anyMatch(child -> Objects.equals(child.getSellerId(), userId));
        if (!isAdmin && !isOwner && !isSeller) {
            throw new AppException("Forbidden", 403, "FORBIDDEN");
        }
        List<Order> visible = (isSeller && !isAdmin) ? children.stream().filter(child -> Objects.equals(child.getSellerId(), userId)).toList() : children;
        return Map.of("parent", parent, "children", visible);
    }

    private void applyAggregates(ParentOrder parent, List<Order> children) {
        List<ParentOrder.ChildSummary> summaries = children.stream()
                .map(c -> ParentOrder.ChildSummary.builder()
                        .orderId(c.getOrderId())
                        .sellerId(c.getSellerId())
                        .orderStatus(c.getOrderStatus())
                        .paymentStatus(c.getPaymentStatus())
                        .totalAmount(c.getTotalAmount())
                        .build())
                .toList();

        parent.setChildOrderIds(children.stream().map(Order::getOrderId).toList());
        parent.setChildSummaries(new ArrayList<>(summaries));
        parent.setAggregateOrderStatus(deriveAggregateOrderStatus(summaries.stream().map(ParentOrder.ChildSummary::getOrderStatus).toList()));
        parent.setAggregatePaymentStatus(deriveAggregatePaymentStatus(summaries.stream().map(ParentOrder.ChildSummary::getPaymentStatus).toList()));
        parent.setTotalMRP(round2(children.stream().mapToDouble(c -> n(c.getTotalMRP())).sum()));
        parent.setTotalDiscount(round2(children.stream().mapToDouble(c -> n(c.getTotalDiscount())).sum()));
        parent.setCouponDiscount(round2(children.stream().mapToDouble(c -> n(c.getCouponDiscount())).sum()));
        parent.setDeliveryFee(round2(children.stream().mapToDouble(c -> n(c.getDeliveryFee())).sum()));
        parent.setTax(round2(children.stream().mapToDouble(c -> n(c.getTax())).sum()));
        parent.setTotalAmount(round2(children.stream().mapToDouble(c -> n(c.getTotalAmount())).sum()));
    }

    private String deriveAggregateOrderStatus(List<String> statuses) {
        Set<String> set = new HashSet<>(statuses);
        if (statuses.isEmpty()) return "PENDING_PAYMENT";
        if (allAre(statuses, List.of("REFUNDED"))) return "REFUNDED";
        if (allAre(statuses, List.of("CANCELLED"))) return "CANCELLED";
        if (hasAny(set, List.of("REFUND_INITIATED"))) return set.size() == 1 ? "REFUND_INITIATED" : "PARTIALLY_REFUNDED";
        if (hasAny(set, List.of("CANCELLED")) && hasAny(set, List.of("DELIVERED"))) return "PARTIALLY_DELIVERED";
        if (hasAny(set, List.of("CANCELLED"))) return "PARTIALLY_CANCELLED";
        if (allAre(statuses, List.of("DELIVERED"))) return "DELIVERED";
        if (hasAny(set, List.of("OUT_FOR_DELIVERY"))) return "OUT_FOR_DELIVERY";
        if (hasAny(set, List.of("SHIPPED"))) return "SHIPPED";
        if (hasAny(set, List.of("PACKED"))) return "PACKED";
        if (hasAny(set, List.of("PROCESSING"))) return "PROCESSING";
        if (hasAny(set, List.of("CONFIRMED"))) return "CONFIRMED";
        return "PENDING_PAYMENT";
    }

    private String deriveAggregatePaymentStatus(List<String> statuses) {
        Set<String> set = new HashSet<>(statuses);
        if (statuses.isEmpty()) return "PENDING";
        if (allAre(statuses, List.of("REFUNDED"))) return "REFUNDED";
        if (hasAny(set, List.of("REFUND_INITIATED"))) return set.size() == 1 ? "REFUND_INITIATED" : "PARTIALLY_REFUNDED";
        if (allAre(statuses, List.of("PAID"))) return "PAID";
        if (hasAny(set, List.of("PAID")) && hasAny(set, List.of("PENDING"))) return "PARTIALLY_PAID";
        return "PENDING";
    }

    private boolean hasAny(Set<String> set, List<String> values) {
        return values.stream().anyMatch(set::contains);
    }

    private boolean allAre(List<String> statuses, List<String> values) {
        return statuses.stream().allMatch(values::contains);
    }

    private double n(Double d) {
        return d == null ? 0 : d;
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
