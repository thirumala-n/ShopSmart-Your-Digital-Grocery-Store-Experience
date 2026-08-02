package com.groceryapp.service;

import com.groceryapp.config.AppProperties;
import com.groceryapp.exception.AppException;
import com.groceryapp.model.*;
import com.groceryapp.repository.*;
import com.groceryapp.util.OrderStatus;
import com.groceryapp.util.PaymentStatus;
import com.groceryapp.util.Roles;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
public class PaymentService {
    private final OrderRepository orderRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final CartRepository cartRepository;
    private final OrderService orderService;
    private final PaymentGatewayService paymentGatewayService;
    private final ProcessedWebhookEventRepository processedWebhookEventRepository;
    private final AppProperties appProperties;

    public PaymentService(
            OrderRepository orderRepository,
            PaymentTransactionRepository paymentTransactionRepository,
            CartRepository cartRepository,
            OrderService orderService,
            PaymentGatewayService paymentGatewayService,
            ProcessedWebhookEventRepository processedWebhookEventRepository,
            AppProperties appProperties
    ) {
        this.orderRepository = orderRepository;
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.cartRepository = cartRepository;
        this.orderService = orderService;
        this.paymentGatewayService = paymentGatewayService;
        this.processedWebhookEventRepository = processedWebhookEventRepository;
        this.appProperties = appProperties;
    }

    public Map<String, Object> createGatewayOrder(String orderId, String userId, String idempotencyKey) {
        String normalizedIdempotencyKey = str(idempotencyKey);
        if (normalizedIdempotencyKey.isBlank()) {
            throw new AppException("idempotencyKey is required", 400, "IDEMPOTENCY_KEY_REQUIRED");
        }

        PaymentTransaction existingTx = paymentTransactionRepository.findByIdempotencyKey(normalizedIdempotencyKey).orElse(null);
        if (existingTx != null && existingTx.getCreatedAt() != null && existingTx.getCreatedAt().isAfter(Instant.now().minusSeconds(24 * 60 * 60))) {
            Order relatedOrder = orderRepository.findById(existingTx.getOrderId()).orElse(null);
            Map<String, Object> meta = existingTx.getMetadata() == null ? Map.of() : existingTx.getMetadata();
            return Map.of(
                    "paymentTransactionId", existingTx.getId(),
                    "orderId", relatedOrder == null ? orderId : relatedOrder.getOrderId(),
                    "externalOrderId", str(existingTx.getExternalOrderId()),
                    "paymentUrl", str(meta.get("paymentUrl")),
                    "amount", num(meta.get("payableAmount"), num(existingTx.getAmount())),
                    "currency", str(existingTx.getCurrency())
            );
        }

        Order requestedOrder = orderRepository.findByOrderId(orderId)
                .orElseThrow(() -> new AppException("Order not found", 404, "ORDER_NOT_FOUND"));
        List<Order> payableOrders = resolvePayableOrdersForRequest(requestedOrder, userId);
        double payableAmount = round2(payableOrders.stream().mapToDouble(o -> num(o.getTotalAmount())).sum());
        String gatewayReference = blank(requestedOrder.getOrderGroupId()) ? requestedOrder.getOrderId() : requestedOrder.getOrderGroupId();
        Map<String, Object> gatewayOrder = paymentGatewayService.createPaymentOrder(gatewayReference, payableAmount, "INR");
        String externalOrderId = str(gatewayOrder.get("externalOrderId"));

        List<PaymentTransaction> created = new ArrayList<>();
        for (Order row : payableOrders) {
            PaymentTransaction tx = PaymentTransaction.builder()
                    .orderId(row.getId())
                    .externalOrderId(externalOrderId)
                    .amount(num(row.getTotalAmount()))
                    .currency("INR")
                    .gateway(str(gatewayOrder.get("provider")))
                    .status("CREATED")
                    .metadata(Map.of(
                            "orderId", row.getOrderId(),
                            "orderGroupId", blank(row.getOrderGroupId()) ? "" : row.getOrderGroupId(),
                            "payableAmount", payableAmount,
                            "paymentUrl", str(gatewayOrder.get("paymentUrl"))
                    ))
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            if (created.isEmpty()) {
                tx.setIdempotencyKey(normalizedIdempotencyKey);
                tx.setIdempotencyExpiresAt(Instant.now().plusSeconds(24 * 60 * 60));
            }
            tx = paymentTransactionRepository.save(tx);
            created.add(tx);

            Order doc = orderRepository.findById(row.getId()).orElse(null);
            if (doc != null) {
                doc.setPaymentGatewayOrderId(externalOrderId);
                doc.setUpdatedAt(Instant.now());
                orderRepository.save(doc);
            }
        }

        return Map.of(
                "paymentTransactionId", created.isEmpty() ? null : created.get(0).getId(),
                "orderId", requestedOrder.getOrderId(),
                "externalOrderId", externalOrderId,
                "paymentUrl", str(gatewayOrder.get("paymentUrl")),
                "amount", num(gatewayOrder.get("amount"), payableAmount),
                "currency", str(gatewayOrder.get("currency"))
        );
    }

    public Map<String, Object> handlePaymentWebhook(Map<String, Object> payload, String signature, byte[] rawBody) {
        PaymentGatewayService.VerifiedWebhook verified = paymentGatewayService.verifyWebhook(payload, signature, rawBody);
        if (!verified.valid()) {
            throw new AppException("Invalid webhook signature", 400, "INVALID_WEBHOOK_SIGNATURE");
        }

        if (!blank(verified.eventId())) {
            ProcessedWebhookEvent existingEvent = processedWebhookEventRepository.findByEventId(verified.eventId()).orElse(null);
            if (existingEvent != null) {
                return Map.of("ok", true, "duplicate", true);
            }
            try {
                processedWebhookEventRepository.save(ProcessedWebhookEvent.builder()
                        .eventId(verified.eventId())
                        .provider(appProperties.getPaymentProvider())
                        .expiresAt(Instant.now().plusSeconds(7L * 24 * 60 * 60))
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build());
            } catch (Exception ignored) {
                return Map.of("ok", true, "duplicate", true);
            }
        }

        PaymentTransaction tx = paymentTransactionRepository.findFirstByExternalOrderId(verified.externalOrderId()).orElse(null);
        if (tx == null && blank(verified.refundReferenceId()) && blank(verified.externalPaymentId())) {
            throw new AppException("Payment transaction not found", 404, "PAYMENT_NOT_FOUND");
        }

        if ("CAPTURED".equalsIgnoreCase(verified.status()) || "payment.captured".equalsIgnoreCase(verified.event())) {
            List<PaymentTransaction> txDocs = paymentTransactionRepository.findByExternalOrderId(verified.externalOrderId());
            if (txDocs.isEmpty()) {
                throw new AppException("Payment transaction not found", 404, "PAYMENT_NOT_FOUND");
            }
            boolean hasPendingCapture = false;
            for (PaymentTransaction txDoc : txDocs) {
                if (!"CAPTURED".equalsIgnoreCase(txDoc.getStatus())) {
                    hasPendingCapture = true;
                    txDoc.setStatus("CAPTURED");
                    if (!blank(verified.externalPaymentId())) {
                        txDoc.setExternalPaymentId(verified.externalPaymentId());
                    }
                    txDoc.setUpdatedAt(Instant.now());
                    paymentTransactionRepository.save(txDoc);
                }
            }
            if (!hasPendingCapture) {
                return Map.of("ok", true, "duplicate", true);
            }

            int confirmedCount = 0;
            for (PaymentTransaction txDoc : txDocs) {
                Order orderDoc = orderRepository.findById(txDoc.getOrderId()).orElse(null);
                if (orderDoc == null || !OrderStatus.PENDING_PAYMENT.equals(orderDoc.getOrderStatus())) {
                    continue;
                }
                orderService.confirmPayment(
                        orderDoc.getOrderId(),
                        verified.externalOrderId(),
                        verified.externalPaymentId(),
                        orderDoc.getUserId(),
                        Roles.ADMIN
                );
                confirmedCount++;
            }
            return Map.of("ok", true, "confirmedCount", confirmedCount);
        }

        if ("REFUNDED".equalsIgnoreCase(verified.status())
                || "refund.processed".equalsIgnoreCase(verified.event())
                || "payment.refund.processed".equalsIgnoreCase(verified.event())) {
            PaymentTransaction refundTx = null;
            if (!blank(verified.refundReferenceId())) {
                refundTx = paymentTransactionRepository.findByRefundReferenceId(verified.refundReferenceId()).orElse(null);
            }
            if (refundTx == null && !blank(verified.externalPaymentId())) {
                refundTx = paymentTransactionRepository.findByExternalPaymentId(verified.externalPaymentId()).orElse(null);
            }
            if (refundTx == null && tx != null) {
                refundTx = paymentTransactionRepository.findById(tx.getId()).orElse(null);
            }
            if (refundTx == null) {
                throw new AppException("Payment transaction not found", 404, "PAYMENT_NOT_FOUND");
            }
            if ("REFUNDED".equalsIgnoreCase(refundTx.getStatus())) {
                return Map.of("ok", true, "duplicate", true);
            }

            refundTx.setStatus("REFUNDED");
            if (!blank(verified.refundReferenceId())) {
                refundTx.setRefundReferenceId(verified.refundReferenceId());
            }
            refundTx.setUpdatedAt(Instant.now());
            paymentTransactionRepository.save(refundTx);

            Order orderDoc = orderRepository.findById(refundTx.getOrderId())
                    .orElseThrow(() -> new AppException("Order not found", 404, "ORDER_NOT_FOUND"));
            if (OrderStatus.REFUNDED.equals(orderDoc.getOrderStatus())) {
                return Map.of("ok", true, "duplicate", true);
            }
            if (!OrderStatus.REFUND_INITIATED.equals(orderDoc.getOrderStatus())) {
                return Map.of("ok", true);
            }
            orderService.transitionOrderStatus(orderDoc.getOrderId(), OrderStatus.REFUNDED, orderDoc.getUserId(), Roles.ADMIN, null, null);
            return Map.of("ok", true);
        }

        if ("FAILED".equalsIgnoreCase(verified.status())) {
            List<PaymentTransaction> txDocs = paymentTransactionRepository.findByExternalOrderId(verified.externalOrderId());
            if (txDocs.isEmpty()) {
                throw new AppException("Payment transaction not found", 404, "PAYMENT_NOT_FOUND");
            }
            List<PaymentTransaction> pending = txDocs.stream().filter(row -> !"FAILED".equalsIgnoreCase(row.getStatus())).toList();
            if (pending.isEmpty()) {
                return Map.of("ok", true, "duplicate", true);
            }
            Set<String> restoredUsers = new HashSet<>();
            for (PaymentTransaction txDoc : pending) {
                txDoc.setStatus("FAILED");
                txDoc.setUpdatedAt(Instant.now());
                paymentTransactionRepository.save(txDoc);

                Order orderDoc = orderRepository.findById(txDoc.getOrderId()).orElse(null);
                if (orderDoc == null || !OrderStatus.PENDING_PAYMENT.equals(orderDoc.getOrderStatus())) continue;

                String userKey = str(orderDoc.getUserId());
                if (restoredUsers.contains(userKey)) continue;
                restoredUsers.add(userKey);
                mergeOrderItemsToCart(orderDoc);
            }
            return Map.of("ok", true);
        }

        return Map.of("ok", true);
    }

    public Map<String, Object> initiateRefund(String orderId, String requestedBy) {
        Order order = orderRepository.findByOrderId(orderId)
                .orElseThrow(() -> new AppException("Order not found", 404, "ORDER_NOT_FOUND"));
        PaymentTransaction tx = paymentTransactionRepository.findFirstByExternalOrderId(order.getPaymentGatewayOrderId())
                .orElseThrow(() -> new AppException("Payment transaction not found", 404, "PAYMENT_NOT_FOUND"));
        Map<String, Object> refund = paymentGatewayService.initiateRefund(tx.getExternalPaymentId(), num(order.getTotalAmount()));

        tx.setStatus("REFUND_INITIATED");
        tx.setRefundReferenceId(str(refund.get("refundReferenceId")));
        tx.setUpdatedAt(Instant.now());
        paymentTransactionRepository.save(tx);

        Order orderDoc = orderRepository.findById(order.getId()).orElseThrow(() -> new AppException("Order not found", 404, "ORDER_NOT_FOUND"));
        orderDoc.setRefundReferenceId(str(refund.get("refundReferenceId")));
        orderDoc.setUpdatedAt(Instant.now());
        orderRepository.save(orderDoc);

        orderService.transitionOrderStatus(order.getOrderId(), OrderStatus.REFUND_INITIATED, requestedBy, Roles.ADMIN, null, null);
        return Map.of("orderId", order.getOrderId(), "refundReferenceId", str(refund.get("refundReferenceId")));
    }

    private List<Order> resolvePayableOrdersForRequest(Order order, String userId) {
        if (!Objects.equals(str(order.getUserId()), str(userId))) {
            throw new AppException("Forbidden", 403, "FORBIDDEN");
        }
        if (!"ONLINE".equalsIgnoreCase(order.getPaymentMethod())) {
            throw new AppException("Order is not online payment type", 400, "PAYMENT_MODE_INVALID");
        }
        if (blank(order.getOrderGroupId())) {
            if (!isPayableOnlineOrder(order)) {
                throw new AppException("Order not in payable state", 400, "ORDER_STATE_INVALID");
            }
            return List.of(order);
        }
        List<Order> children = orderRepository.findByOrderGroupIdOrderByCreatedAtAsc(order.getOrderGroupId());
        List<Order> sameUserChildren = children.stream().filter(row -> Objects.equals(str(row.getUserId()), str(userId))).toList();
        List<Order> payableChildren = sameUserChildren.stream().filter(this::isPayableOnlineOrder).toList();
        if (payableChildren.isEmpty()) {
            throw new AppException("Order group has no payable child orders", 400, "ORDER_STATE_INVALID");
        }
        return payableChildren;
    }

    private boolean isPayableOnlineOrder(Order order) {
        return order != null
                && "ONLINE".equalsIgnoreCase(order.getPaymentMethod())
                && OrderStatus.PENDING_PAYMENT.equals(order.getOrderStatus())
                && PaymentStatus.PENDING.equals(order.getPaymentStatus());
    }

    private void mergeOrderItemsToCart(Order orderDoc) {
        Cart cart = cartRepository.findByUserId(orderDoc.getUserId()).orElseGet(() -> Cart.builder()
                .userId(orderDoc.getUserId())
                .items(new ArrayList<>())
                .couponCode("")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build());
        List<Cart.CartItem> items = cart.getItems() == null ? new ArrayList<>() : new ArrayList<>(cart.getItems());
        for (Order.OrderItem item : (orderDoc.getOrderItems() == null ? List.<Order.OrderItem>of() : orderDoc.getOrderItems())) {
            int quantity = item.getQuantity() == null ? 0 : item.getQuantity();
            if (quantity <= 0) continue;
            Cart.CartItem existing = items.stream()
                    .filter(row -> Objects.equals(row.getProductId(), item.getProductId()) && Objects.equals(row.getVariantId(), item.getVariantId()))
                    .findFirst().orElse(null);
            if (existing != null) {
                existing.setQuantity((existing.getQuantity() == null ? 0 : existing.getQuantity()) + quantity);
            } else {
                items.add(Cart.CartItem.builder()
                        .productId(item.getProductId())
                        .variantId(item.getVariantId())
                        .quantity(quantity)
                        .build());
            }
        }
        cart.setItems(items);
        if (!blank(orderDoc.getCouponCode()) && blank(cart.getCouponCode())) {
            cart.setCouponCode(orderDoc.getCouponCode().toUpperCase(Locale.ROOT));
        }
        cart.setUpdatedAt(Instant.now());
        cartRepository.save(cart);
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private boolean blank(String value) {
        return value == null || value.trim().isBlank();
    }

    private double num(Double value) {
        return value == null ? 0d : value;
    }

    private double num(Object value, double def) {
        try {
            return value == null ? def : Double.parseDouble(String.valueOf(value));
        } catch (Exception ex) {
            return def;
        }
    }

    private double round2(double val) {
        return Math.round(val * 100.0) / 100.0;
    }
}
