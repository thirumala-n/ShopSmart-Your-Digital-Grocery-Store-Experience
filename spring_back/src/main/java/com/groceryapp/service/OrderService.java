package com.groceryapp.service;

import com.groceryapp.config.AppProperties;
import com.groceryapp.exception.AppException;
import com.groceryapp.model.*;
import com.groceryapp.repository.*;
import com.groceryapp.util.IdGenerator;
import com.groceryapp.util.OrderStatus;
import com.groceryapp.util.OrderTransitions;
import com.groceryapp.util.PaymentStatus;
import com.groceryapp.util.Roles;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OrderService {
    private final CartRepository cartRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final ParentOrderRepository parentOrderRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final UserRepository userRepository;
    private final DeliverySlotRepository deliverySlotRepository;
    private final CouponService couponService;
    private final PricingService pricingService;
    private final InventoryService inventoryService;
    private final ParentOrderService parentOrderService;
    private final PaymentGatewayService paymentGatewayService;
    private final NotificationService notificationService;
    private final AppProperties appProperties;

    public OrderService(
            CartRepository cartRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository,
            ParentOrderRepository parentOrderRepository,
            PaymentTransactionRepository paymentTransactionRepository,
            UserRepository userRepository,
            DeliverySlotRepository deliverySlotRepository,
            CouponService couponService,
            PricingService pricingService,
            InventoryService inventoryService,
            ParentOrderService parentOrderService,
            PaymentGatewayService paymentGatewayService,
            NotificationService notificationService,
            AppProperties appProperties
    ) {
        this.cartRepository = cartRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.parentOrderRepository = parentOrderRepository;
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.userRepository = userRepository;
        this.deliverySlotRepository = deliverySlotRepository;
        this.couponService = couponService;
        this.pricingService = pricingService;
        this.inventoryService = inventoryService;
        this.parentOrderService = parentOrderService;
        this.paymentGatewayService = paymentGatewayService;
        this.notificationService = notificationService;
        this.appProperties = appProperties;
    }

    public Map<String, Object> createPendingOrder(String userId, Map<String, Object> shippingAddressPayload, String deliverySlotId, String paymentMethod, String couponCode) {
        Cart cart = cartRepository.findByUserId(userId).orElseThrow(() -> new AppException("Cart is empty", 400, "EMPTY_CART"));
        if (cart.getItems() == null || cart.getItems().isEmpty()) {
            throw new AppException("Cart is empty", 400, "EMPTY_CART");
        }

        DeliverySlot slot = reserveSlot(deliverySlotId);

        LoadResult load = loadCartItemsWithServerPrices(cart.getItems());
        if (!load.outOfStock().isEmpty()) {
            throw new AppException("Some items are out of stock", 409, "INSUFFICIENT_STOCK", load.outOfStock());
        }
        List<PreparedOrderItem> prepared = load.items();

        PricingService.PricingSummary pricing = pricingService.calculatePricingSummary(
                prepared.stream().map(PreparedOrderItem::toCartLine).toList(),
                userId,
                couponCode == null || couponCode.isBlank() ? cart.getCouponCode() : couponCode,
                prepared.stream().map(PreparedOrderItem::categoryId).toList()
        );

        double subtotal = pricing.subtotal();
        double couponDiscount = pricing.couponDiscount();
        String appliedCouponCode = pricing.couponResult().valid()
                ? ((couponCode == null || couponCode.isBlank()) ? safeUpper(cart.getCouponCode()) : safeUpper(couponCode))
                : "";

        String orderGroupId = IdGenerator.createOrderGroupId();
        Map<String, List<PreparedOrderItem>> bySeller = prepared.stream().collect(Collectors.groupingBy(PreparedOrderItem::sellerId));
        List<Order> created = new ArrayList<>();
        int sellerIdx = 0;
        Instant now = Instant.now();

        for (Map.Entry<String, List<PreparedOrderItem>> e : bySeller.entrySet()) {
            String sellerId = e.getKey();
            List<PreparedOrderItem> sellerItems = e.getValue();
            double sellerSubtotal = round2(sellerItems.stream().mapToDouble(PreparedOrderItem::lineTotal).sum());
            double sellerMrp = round2(sellerItems.stream().mapToDouble(i -> i.quantity() * i.unitMRP()).sum());
            double sellerDiscount = round2(sellerMrp - sellerSubtotal);
            double proportionalCoupon = subtotal > 0 ? round2((sellerSubtotal / subtotal) * couponDiscount) : 0;
            double sellerDeliveryFee = sellerIdx == 0 ? pricing.deliveryFee() : 0;
            double taxableAmount = Math.max(0, sellerSubtotal - proportionalCoupon);
            double tax = round2((taxableAmount * appProperties.getTaxPercent()) / 100d);
            double totalAmount = round2(taxableAmount + tax + sellerDeliveryFee);

            String initialStatus = "COD".equalsIgnoreCase(paymentMethod) ? OrderStatus.CONFIRMED : OrderStatus.PENDING_PAYMENT;
            String initialPaymentStatus = "COD".equalsIgnoreCase(paymentMethod) ? PaymentStatus.PAID : PaymentStatus.PENDING;

            Order order = Order.builder()
                    .orderId(IdGenerator.createOrderId())
                    .orderGroupId(orderGroupId)
                    .userId(userId)
                    .sellerId(sellerId)
                    .orderItems(sellerItems.stream().map(PreparedOrderItem::toOrderItem).toList())
                    .shippingAddress(toAddress(shippingAddressPayload))
                    .deliverySlot(Order.DeliverySlotInfo.builder().date(slot.getDate()).timeWindow(slot.getTimeWindow()).build())
                    .paymentMethod(paymentMethod)
                    .paymentStatus(initialPaymentStatus)
                    .orderStatus(initialStatus)
                    .statusHistory(new ArrayList<>(List.of(Order.StatusHistory.builder()
                            .status(initialStatus)
                            .timestamp(now)
                            .note("COD".equalsIgnoreCase(paymentMethod) ? "COD order confirmed" : "Order created")
                            .updatedBy(userId)
                            .build())))
                    .trackingId("")
                    .totalMRP(sellerMrp)
                    .totalDiscount(sellerDiscount)
                    .couponCode(appliedCouponCode)
                    .couponDiscount(proportionalCoupon)
                    .deliveryFee(sellerDeliveryFee)
                    .tax(tax)
                    .totalAmount(totalAmount)
                    .otpAttemptCount(0)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            order = orderRepository.save(order);
            created.add(order);
            sellerIdx += 1;

            if ("COD".equalsIgnoreCase(paymentMethod)) {
                inventoryService.decrementStockForOrderItems(sellerItems, userId, order.getId());
            }
        }

        if (pricing.couponResult().valid()) {
            couponService.markCouponUsed(pricing.couponResult().coupon(), userId);
        }

        cart.setItems(new ArrayList<>());
        cart.setCouponCode("");
        cartRepository.save(cart);

        parentOrderService.createFromChildOrders(
                orderGroupId,
                userId,
                toAddress(shippingAddressPayload),
                Order.DeliverySlotInfo.builder().date(slot.getDate()).timeWindow(slot.getTimeWindow()).build(),
                paymentMethod,
                appliedCouponCode
        );

        return Map.of(
                "orderGroupId", orderGroupId,
                "orderId", created.isEmpty() ? "" : created.get(0).getOrderId(),
                "orderIds", created.stream().map(Order::getOrderId).toList(),
                "totalOrders", created.size()
        );
    }

    public Order confirmPayment(String orderId, String paymentGatewayOrderId, String paymentGatewayPaymentId, String updatedBy, String updatedByRole) {
        Order order = orderRepository.findByOrderId(orderId).orElseThrow(() -> new AppException("Order not found", 404, "ORDER_NOT_FOUND"));
        boolean isAdmin = Roles.ADMIN.equalsIgnoreCase(updatedByRole);
        boolean isOwner = Objects.equals(order.getUserId(), updatedBy);
        if (!isAdmin && !isOwner) throw new AppException("Forbidden", 403, "FORBIDDEN");
        if (!OrderStatus.PENDING_PAYMENT.equals(order.getOrderStatus())) {
            throw new AppException("Order is not awaiting payment", 400, "ORDER_STATE_INVALID");
        }

        OrderTransitions.assertTransition(order.getOrderStatus(), OrderStatus.CONFIRMED, PaymentStatus.PAID);
        inventoryService.decrementStockForOrderItems(preparedFromOrder(order), updatedBy, order.getId());

        order.setPaymentStatus(PaymentStatus.PAID);
        if (paymentGatewayOrderId != null && !paymentGatewayOrderId.isBlank()) order.setPaymentGatewayOrderId(paymentGatewayOrderId);
        if (paymentGatewayPaymentId != null && !paymentGatewayPaymentId.isBlank()) order.setPaymentGatewayPaymentId(paymentGatewayPaymentId);
        order.setOrderStatus(OrderStatus.CONFIRMED);
        pushHistory(order, OrderStatus.CONFIRMED, "Payment confirmed", updatedBy);
        order.setUpdatedAt(Instant.now());
        order = orderRepository.save(order);
        if (order.getOrderGroupId() != null && !order.getOrderGroupId().isBlank()) {
            parentOrderService.refreshAggregateForGroup(order.getOrderGroupId());
        }
        return order;
    }

    public Order transitionOrderStatus(String orderId, String nextStatus, String updatedBy, String updatedByRole, String deliveryOtp, String trackingId) {
        Order order = orderRepository.findByOrderId(orderId).orElseThrow(() -> new AppException("Order not found", 404, "ORDER_NOT_FOUND"));
        assertOrderTransitionActorAccess(order, nextStatus, updatedBy, updatedByRole);
        OrderTransitions.assertTransition(order.getOrderStatus(), nextStatus, order.getPaymentStatus());

        if (OrderStatus.PACKED.equals(nextStatus)) {
            order.setTrackingId(IdGenerator.createTrackingId());
        }
        if (OrderStatus.SHIPPED.equals(nextStatus) && trackingId != null && !trackingId.isBlank()) {
            order.setTrackingId(trackingId);
        }
        if (OrderStatus.OUT_FOR_DELIVERY.equals(nextStatus)) {
            String otpRaw = com.groceryapp.util.CryptoUtil.numericOtp(6);
            order.setDeliveryOTP(passwordEncoded(otpRaw));
            order.setDeliveryOTPExpiry(Instant.now().plusSeconds(30 * 60));
            order.setOtpAttemptCount(0);
            order.setOtpLockedUntil(null);
            User user = userRepository.findById(order.getUserId()).orElse(null);
            notificationService.sendOtpNotification(order.getOrderId(), otpRaw, user == null ? "" : user.getEmail(), user == null ? "" : user.getPhone());
        }
        if (OrderStatus.DELIVERED.equals(nextStatus)) {
            verifyDeliveryOtp(order, deliveryOtp);
            for (Order.OrderItem item : order.getOrderItems()) {
                productRepository.findById(item.getProductId()).ifPresent(product -> {
                    product.setSalesCount((product.getSalesCount() == null ? 0 : product.getSalesCount()) + (item.getQuantity() == null ? 0 : item.getQuantity()));
                    productRepository.save(product);
                });
            }
        }
        if (OrderStatus.CANCELLED.equals(nextStatus)
                && (OrderStatus.CONFIRMED.equals(order.getOrderStatus()) || OrderStatus.PROCESSING.equals(order.getOrderStatus()))) {
            inventoryService.restoreStockForOrderItems(preparedFromOrder(order), updatedBy, order.getId());
        }
        if (OrderStatus.REFUND_INITIATED.equals(nextStatus)) {
            order.setPaymentStatus(PaymentStatus.REFUND_INITIATED);
        }
        if (OrderStatus.REFUNDED.equals(nextStatus)) {
            order.setPaymentStatus(PaymentStatus.REFUNDED);
        }

        order.setOrderStatus(nextStatus);
        pushHistory(order, nextStatus, "Status updated", updatedBy);
        order.setUpdatedAt(Instant.now());
        order = orderRepository.save(order);

        if (order.getOrderGroupId() != null && !order.getOrderGroupId().isBlank()) {
            ParentOrder parent = parentOrderService.refreshAggregateForGroup(order.getOrderGroupId());
            releaseDeliverySlotForGroupIfEligible(parent);
        } else if (OrderStatus.CANCELLED.equals(nextStatus)) {
            releaseSlot(order.getDeliverySlot());
        }
        return order;
    }

    public Map<String, Object> cancelOrderGroup(String orderGroupId, String actorUserId, String actorRole) {
        ParentOrder parent = parentOrderRepository.findByOrderGroupId(orderGroupId)
                .orElseThrow(() -> new AppException("Order group not found", 404, "ORDER_GROUP_NOT_FOUND"));
        assertGroupActorAccess(parent, actorUserId, actorRole, false);

        List<Order> children = orderRepository.findByOrderGroupIdOrderByCreatedAtAsc(orderGroupId);
        List<Order> cancellable = children.stream()
                .filter(c -> List.of(OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED, OrderStatus.PROCESSING).contains(c.getOrderStatus()))
                .toList();
        List<Map<String, String>> blocked = children.stream()
                .filter(c -> !List.of(OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.CANCELLED, OrderStatus.REFUND_INITIATED, OrderStatus.REFUNDED).contains(c.getOrderStatus()))
                .map(c -> Map.of("orderId", c.getOrderId(), "status", c.getOrderStatus()))
                .toList();
        if (!blocked.isEmpty()) {
            throw new AppException("Some child orders are no longer cancellable", 409, "GROUP_CANCELLATION_BLOCKED", blocked);
        }
        if (cancellable.isEmpty()) {
            throw new AppException("No cancellable child orders found in this group", 409, "NO_CANCELLABLE_CHILD_ORDERS");
        }
        for (Order child : cancellable) {
            transitionOrderStatus(child.getOrderId(), OrderStatus.CANCELLED, actorUserId, actorRole, null, null);
        }
        ParentOrder refreshed = parentOrderService.refreshAggregateForGroup(orderGroupId);
        List<Order> childOrders = orderRepository.findByOrderGroupIdOrderByCreatedAtAsc(orderGroupId);
        return Map.of(
                "orderGroupId", orderGroupId,
                "aggregateOrderStatus", refreshed.getAggregateOrderStatus(),
                "aggregatePaymentStatus", refreshed.getAggregatePaymentStatus(),
                "cancelledCount", cancellable.size(),
                "children", childOrders
        );
    }

    public Map<String, Object> initiateGroupRefund(String orderGroupId, String actorUserId, String actorRole) {
        ParentOrder parent = parentOrderRepository.findByOrderGroupId(orderGroupId)
                .orElseThrow(() -> new AppException("Order group not found", 404, "ORDER_GROUP_NOT_FOUND"));
        assertGroupActorAccess(parent, actorUserId, actorRole, true);
        List<Order> children = orderRepository.findByOrderGroupIdOrderByCreatedAtAsc(orderGroupId);

        List<Map<String, String>> paidNotCancelled = children.stream()
                .filter(c -> PaymentStatus.PAID.equals(c.getPaymentStatus()) && !OrderStatus.CANCELLED.equals(c.getOrderStatus()))
                .map(c -> Map.of("orderId", c.getOrderId(), "orderStatus", c.getOrderStatus(), "paymentStatus", c.getPaymentStatus()))
                .toList();
        if (!paidNotCancelled.isEmpty()) {
            throw new AppException("Refund can be initiated only for cancelled paid child orders", 409, "GROUP_REFUND_BLOCKED", paidNotCancelled);
        }

        List<Order> targets = children.stream()
                .filter(c -> OrderStatus.CANCELLED.equals(c.getOrderStatus()) && PaymentStatus.PAID.equals(c.getPaymentStatus()))
                .toList();
        if (targets.isEmpty()) {
            throw new AppException("No refundable child orders found in this group", 409, "NO_REFUNDABLE_CHILD_ORDERS");
        }

        List<Map<String, Object>> refunds = new ArrayList<>();
        for (Order child : targets) {
            PaymentTransaction tx = paymentTransactionRepository.findByOrderId(child.getId()).orElseThrow(() ->
                    new AppException("Payment transaction not found for child order " + child.getOrderId(), 404, "PAYMENT_NOT_FOUND"));
            if (tx.getExternalPaymentId() == null || tx.getExternalPaymentId().isBlank()) {
                throw new AppException("Payment transaction not found for child order " + child.getOrderId(), 404, "PAYMENT_NOT_FOUND");
            }
            Map<String, Object> refund = paymentGatewayService.initiateRefund(tx.getExternalPaymentId(), n(child.getTotalAmount()));
            tx.setStatus("REFUND_INITIATED");
            tx.setRefundReferenceId(String.valueOf(refund.get("refundReferenceId")));
            paymentTransactionRepository.save(tx);
            child.setRefundReferenceId(tx.getRefundReferenceId());
            orderRepository.save(child);
            transitionOrderStatus(child.getOrderId(), OrderStatus.REFUND_INITIATED, actorUserId, actorRole, null, null);
            refunds.add(Map.of("orderId", child.getOrderId(), "refundReferenceId", tx.getRefundReferenceId()));
        }
        ParentOrder refreshed = parentOrderService.refreshAggregateForGroup(orderGroupId);
        List<Order> childOrders = orderRepository.findByOrderGroupIdOrderByCreatedAtAsc(orderGroupId);
        return Map.of(
                "orderGroupId", orderGroupId,
                "aggregateOrderStatus", refreshed.getAggregateOrderStatus(),
                "aggregatePaymentStatus", refreshed.getAggregatePaymentStatus(),
                "refunds", refunds,
                "children", childOrders
        );
    }

    public Map<String, Object> settleGroupRefund(String orderGroupId, String actorUserId, String actorRole, String refundReferenceId) {
        ParentOrder parent = parentOrderRepository.findByOrderGroupId(orderGroupId)
                .orElseThrow(() -> new AppException("Order group not found", 404, "ORDER_GROUP_NOT_FOUND"));
        assertGroupActorAccess(parent, actorUserId, actorRole, true);
        List<Order> children = orderRepository.findByOrderGroupIdOrderByCreatedAtAsc(orderGroupId);
        List<Map<String, String>> invalid = children.stream()
                .filter(c -> !List.of(OrderStatus.REFUND_INITIATED, OrderStatus.REFUNDED).contains(c.getOrderStatus()))
                .map(c -> Map.of("orderId", c.getOrderId(), "orderStatus", c.getOrderStatus()))
                .toList();
        if (!invalid.isEmpty()) {
            throw new AppException("All child orders must be in REFUND_INITIATED or REFUNDED before settlement", 409, "GROUP_REFUND_SETTLEMENT_BLOCKED", invalid);
        }
        List<Order> targets = children.stream().filter(c -> OrderStatus.REFUND_INITIATED.equals(c.getOrderStatus())).toList();
        if (targets.isEmpty()) {
            throw new AppException("No refundable child orders pending settlement", 409, "NO_PENDING_GROUP_REFUNDS");
        }
        for (Order child : targets) {
            paymentTransactionRepository.findByOrderId(child.getId()).ifPresent(tx -> {
                tx.setStatus("REFUNDED");
                if (refundReferenceId != null && !refundReferenceId.isBlank()) tx.setRefundReferenceId(refundReferenceId);
                paymentTransactionRepository.save(tx);
            });
            transitionOrderStatus(child.getOrderId(), OrderStatus.REFUNDED, actorUserId, actorRole, null, null);
        }
        ParentOrder refreshed = parentOrderService.refreshAggregateForGroup(orderGroupId);
        List<Order> childOrders = orderRepository.findByOrderGroupIdOrderByCreatedAtAsc(orderGroupId);
        return Map.of(
                "orderGroupId", orderGroupId,
                "aggregateOrderStatus", refreshed.getAggregateOrderStatus(),
                "aggregatePaymentStatus", refreshed.getAggregatePaymentStatus(),
                "refundedCount", targets.size(),
                "children", childOrders
        );
    }

    public List<Order> listByGroupId(String orderGroupId) {
        return orderRepository.findByOrderGroupIdOrderByCreatedAtAsc(orderGroupId);
    }

    public Map<String, Object> listUserOrders(String userId, boolean activeOnly, int page, int pageSize) {
        int safePage = Math.max(1, page);
        int safePageSize = Math.max(1, Math.min(100, pageSize));
        List<String> activeTerminal = List.of(OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED);
        List<Order> filtered = orderRepository.findAll().stream()
                .filter(order -> Objects.equals(order.getUserId(), userId))
                .filter(order -> activeOnly
                        ? !activeTerminal.contains(order.getOrderStatus())
                        : activeTerminal.contains(order.getOrderStatus()))
                .sorted((a, b) -> {
                    Instant aa = a.getCreatedAt() == null ? Instant.EPOCH : a.getCreatedAt();
                    Instant bb = b.getCreatedAt() == null ? Instant.EPOCH : b.getCreatedAt();
                    return bb.compareTo(aa);
                })
                .toList();
        int total = filtered.size();
        int from = Math.min((safePage - 1) * safePageSize, total);
        int to = Math.min(from + safePageSize, total);
        List<Order> items = filtered.subList(from, to);
        return Map.of(
                "items", items,
                "total", total,
                "page", safePage,
                "pageSize", safePageSize,
                "totalPages", Math.max(1, (int) Math.ceil(total / (double) safePageSize))
        );
    }

    public Map<String, Object> listUserOrderGroups(String userId, boolean activeOnly, int page, int pageSize) {
        int safePage = Math.max(1, page);
        int safePageSize = Math.max(1, Math.min(100, pageSize));
        List<String> activeOnlyExclusions = List.of("DELIVERED", "CANCELLED", "PARTIALLY_CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED");
        List<String> historyOnly = List.of("DELIVERED", "CANCELLED", "PARTIALLY_CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED", "PARTIALLY_DELIVERED");
        List<ParentOrder> filtered = parentOrderRepository.findAll().stream()
                .filter(row -> Objects.equals(row.getUserId(), userId))
                .filter(row -> activeOnly
                        ? !activeOnlyExclusions.contains(row.getAggregateOrderStatus())
                        : historyOnly.contains(row.getAggregateOrderStatus()))
                .sorted((a, b) -> {
                    Instant aa = a.getCreatedAt() == null ? Instant.EPOCH : a.getCreatedAt();
                    Instant bb = b.getCreatedAt() == null ? Instant.EPOCH : b.getCreatedAt();
                    return bb.compareTo(aa);
                })
                .toList();
        int total = filtered.size();
        int from = Math.min((safePage - 1) * safePageSize, total);
        int to = Math.min(from + safePageSize, total);
        List<ParentOrder> items = filtered.subList(from, to);
        return Map.of(
                "items", items,
                "total", total,
                "page", safePage,
                "pageSize", safePageSize,
                "totalPages", Math.max(1, (int) Math.ceil(total / (double) safePageSize))
        );
    }

    public Order getOrderForActor(String orderId, String actorUserId, String actorRole) {
        Order order = orderRepository.findByOrderId(orderId).orElseThrow(() -> new AppException("Order not found", 404, "ORDER_NOT_FOUND"));
        boolean isAdmin = Roles.ADMIN.equalsIgnoreCase(actorRole);
        boolean isSeller = Roles.SELLER.equalsIgnoreCase(actorRole) && Objects.equals(order.getSellerId(), actorUserId);
        boolean isOwner = Objects.equals(order.getUserId(), actorUserId);
        if (!isAdmin && !isSeller && !isOwner) {
            throw new AppException("Forbidden", 403, "FORBIDDEN");
        }
        return order;
    }

    private DeliverySlot reserveSlot(String deliverySlotId) {
        if (deliverySlotId == null || deliverySlotId.isBlank()) {
            return DeliverySlot.builder()
                    .date(Instant.now())
                    .timeWindow("On-demand")
                    .capacity(0)
                    .booked(0)
                    .isActive(true)
                    .build();
        }
        DeliverySlot slot = deliverySlotRepository.findById(deliverySlotId).orElseThrow(() -> new AppException("Delivery slot unavailable", 409, "DELIVERY_SLOT_UNAVAILABLE"));
        int booked = slot.getBooked() == null ? 0 : slot.getBooked();
        int capacity = slot.getCapacity() == null ? 0 : slot.getCapacity();
        if (!Boolean.TRUE.equals(slot.getIsActive()) || booked >= capacity) {
            throw new AppException("Delivery slot unavailable", 409, "DELIVERY_SLOT_UNAVAILABLE");
        }
        slot.setBooked(booked + 1);
        return deliverySlotRepository.save(slot);
    }

    private LoadResult loadCartItemsWithServerPrices(List<Cart.CartItem> cartItems) {
        List<Map<String, Object>> outOfStock = new ArrayList<>();
        List<PreparedOrderItem> prepared = new ArrayList<>();
        Map<String, Product> products = productRepository.findByIdIn(cartItems.stream().map(Cart.CartItem::getProductId).distinct().toList()).stream()
                .collect(Collectors.toMap(Product::getId, p -> p));

        for (Cart.CartItem line : cartItems) {
            Product product = products.get(line.getProductId());
            if (product == null || !Boolean.TRUE.equals(product.getIsActive()) || !Boolean.TRUE.equals(product.getAdminApproved())) continue;
            Product.Variant variant = product.getVariants() == null ? null : product.getVariants().stream()
                    .filter(v -> Objects.equals(v.getVariantId(), line.getVariantId()))
                    .findFirst().orElse(null);
            int qty = line.getQuantity() == null ? 0 : line.getQuantity();
            if (variant == null || variant.getStock() == null || variant.getStock() < qty) {
                outOfStock.add(Map.of("productId", line.getProductId(), "variantId", line.getVariantId(), "requestedQty", qty));
                continue;
            }
            prepared.add(new PreparedOrderItem(
                    product.getId(),
                    variant.getVariantId(),
                    product.getName(),
                    variant.getWeight(),
                    qty,
                    n(variant.getPrice()),
                    n(variant.getMRP()),
                    round2(qty * n(variant.getPrice())),
                    product.getSellerId(),
                    product.getCategoryId(),
                    "Seller"
            ));
        }
        return new LoadResult(prepared, outOfStock);
    }

    private void assertOrderTransitionActorAccess(Order order, String nextStatus, String actorUserId, String actorRole) {
        String role = normalizeRole(actorRole);
        boolean isAdmin = Roles.ADMIN.equals(role);
        if (isAdmin) return;

        boolean isOwner = Objects.equals(order.getUserId(), actorUserId);
        boolean isSeller = Objects.equals(order.getSellerId(), actorUserId);
        List<String> sellerAllowed = List.of(OrderStatus.PROCESSING, OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED);

        if (Roles.SELLER.equals(role)) {
            if (isSeller && sellerAllowed.contains(nextStatus)) return;
            throw new AppException("Forbidden status transition for seller", 403, "FORBIDDEN");
        }
        if (Roles.CUSTOMER.equals(role)) {
            if (isOwner && OrderStatus.CANCELLED.equals(nextStatus)) return;
            throw new AppException("Forbidden status transition for user", 403, "FORBIDDEN");
        }
        throw new AppException("Forbidden", 403, "FORBIDDEN");
    }

    private void assertGroupActorAccess(ParentOrder parent, String actorUserId, String actorRole, boolean adminOnly) {
        boolean isAdmin = Roles.ADMIN.equals(normalizeRole(actorRole));
        if (adminOnly && !isAdmin) throw new AppException("Only admin can perform this group action", 403, "FORBIDDEN");
        boolean isOwner = Objects.equals(parent.getUserId(), actorUserId);
        if (!isAdmin && !isOwner) throw new AppException("Forbidden", 403, "FORBIDDEN");
    }

    private String normalizeRole(String role) {
        String value = role == null ? "" : role.trim().toLowerCase(Locale.ROOT);
        if (Roles.ADMIN.equals(value) || Roles.CUSTOMER.equals(value) || Roles.SELLER.equals(value)) return value;
        return "";
    }

    private void verifyDeliveryOtp(Order order, String deliveryOtp) {
        if (deliveryOtp == null || deliveryOtp.isBlank()) throw new AppException("Delivery OTP is required", 400, "DELIVERY_OTP_REQUIRED");
        if (order.getOtpLockedUntil() != null && order.getOtpLockedUntil().isAfter(Instant.now())) {
            throw new AppException("Delivery OTP locked. Try again later", 423, "DELIVERY_OTP_LOCKED");
        }
        if (order.getDeliveryOTP() == null || order.getDeliveryOTPExpiry() == null || order.getDeliveryOTPExpiry().isBefore(Instant.now())) {
            throw new AppException("Delivery OTP expired", 400, "DELIVERY_OTP_EXPIRED");
        }
        if (!passwordMatches(deliveryOtp, order.getDeliveryOTP())) {
            int attempts = (order.getOtpAttemptCount() == null ? 0 : order.getOtpAttemptCount()) + 1;
            order.setOtpAttemptCount(attempts);
            if (attempts >= 5) order.setOtpLockedUntil(Instant.now().plusSeconds(30 * 60));
            orderRepository.save(order);
            throw new AppException("Invalid delivery OTP", 400, "DELIVERY_OTP_INVALID");
        }
        order.setOtpAttemptCount(0);
        order.setOtpLockedUntil(null);
        order.setDeliveryOTP("");
        order.setDeliveryOTPExpiry(null);
    }

    private void pushHistory(Order order, String status, String note, String updatedBy) {
        List<Order.StatusHistory> history = order.getStatusHistory() == null ? new ArrayList<>() : order.getStatusHistory();
        history.add(Order.StatusHistory.builder().status(status).timestamp(Instant.now()).note(note).updatedBy(updatedBy).build());
        order.setStatusHistory(history);
    }

    private void releaseDeliverySlotForGroupIfEligible(ParentOrder parent) {
        if (parent == null) return;
        if (!OrderStatus.CANCELLED.equals(parent.getAggregateOrderStatus()) || Boolean.TRUE.equals(parent.getDeliverySlotReleased())) return;
        releaseSlot(parent.getDeliverySlot());
        parent.setDeliverySlotReleased(true);
        parentOrderRepository.save(parent);
    }

    private void releaseSlot(Order.DeliverySlotInfo slotInfo) {
        if (slotInfo == null || slotInfo.getDate() == null || slotInfo.getTimeWindow() == null) return;
        List<DeliverySlot> matches = deliverySlotRepository.findByDateBetweenAndIsActiveOrderByDateAscTimeWindowAsc(
                slotInfo.getDate().minusSeconds(1),
                slotInfo.getDate().plusSeconds(1),
                true
        );
        for (DeliverySlot slot : matches) {
            if (Objects.equals(slot.getTimeWindow(), slotInfo.getTimeWindow())) {
                int booked = slot.getBooked() == null ? 0 : slot.getBooked();
                if (booked > 0) {
                    slot.setBooked(booked - 1);
                    deliverySlotRepository.save(slot);
                }
                return;
            }
        }
    }

    private String safeUpper(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
    }

    private Order.Address toAddress(Map<String, Object> payload) {
        return Order.Address.builder()
                .label(str(payload.getOrDefault("label", "Home")))
                .fullName(str(payload.get("fullName")))
                .phone(str(payload.get("phone")))
                .line1(str(payload.get("line1")))
                .line2(str(payload.get("line2")))
                .city(str(payload.get("city")))
                .state(str(payload.get("state")))
                .pincode(str(payload.get("pincode")))
                .build();
    }

    private List<PreparedOrderItem> preparedFromOrder(Order order) {
        List<PreparedOrderItem> out = new ArrayList<>();
        if (order.getOrderItems() == null) return out;
        for (Order.OrderItem item : order.getOrderItems()) {
            out.add(new PreparedOrderItem(
                    item.getProductId(),
                    item.getVariantId(),
                    item.getProductName(),
                    item.getVariantLabel(),
                    item.getQuantity() == null ? 0 : item.getQuantity(),
                    n(item.getUnitPrice()),
                    n(item.getUnitMRP()),
                    n(item.getLineTotal()),
                    order.getSellerId(),
                    "",
                    item.getSellerName()
            ));
        }
        return out;
    }

    private String passwordEncoded(String raw) {
        return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(Math.max(12, appProperties.getBcryptSaltRounds())).encode(raw);
    }

    private boolean passwordMatches(String raw, String hash) {
        return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(Math.max(12, appProperties.getBcryptSaltRounds())).matches(raw, hash);
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private double n(Double v) {
        return v == null ? 0 : v;
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    public record PreparedOrderItem(
            String productId,
            String variantId,
            String productName,
            String variantLabel,
            int quantity,
            double unitPrice,
            double unitMRP,
            double lineTotal,
            String sellerId,
            String categoryId,
            String sellerName
    ) {
        public PricingService.CartLine toCartLine() {
            return new PricingService.CartLine(productId, variantId, productName, variantLabel, quantity, unitPrice, unitMRP, lineTotal, Integer.MAX_VALUE, "", sellerId, categoryId);
        }

        public Order.OrderItem toOrderItem() {
            return Order.OrderItem.builder()
                    .productId(productId)
                    .variantId(variantId)
                    .productName(productName)
                    .variantLabel(variantLabel)
                    .quantity(quantity)
                    .unitPrice(unitPrice)
                    .unitMRP(unitMRP)
                    .lineTotal(lineTotal)
                    .sellerName(sellerName)
                    .build();
        }
    }

    private record LoadResult(List<PreparedOrderItem> items, List<Map<String, Object>> outOfStock) {
    }
}
