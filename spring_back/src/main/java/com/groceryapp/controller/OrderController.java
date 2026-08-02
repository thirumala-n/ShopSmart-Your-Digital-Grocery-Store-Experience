package com.groceryapp.controller;

import com.groceryapp.model.Order;
import com.groceryapp.security.AuthContext;
import com.groceryapp.security.AuthUser;
import com.groceryapp.service.OrderService;
import com.groceryapp.service.ParentOrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderService orderService;
    private final ParentOrderService parentOrderService;

    public OrderController(OrderService orderService, ParentOrderService parentOrderService) {
        this.orderService = orderService;
        this.parentOrderService = parentOrderService;
    }

    @GetMapping("/my")
    public Map<String, Object> listMyOrders(@RequestParam(required = false) String type,
                                            @RequestParam(required = false) Integer page,
                                            @RequestParam(required = false) Integer pageSize) {
        boolean activeOnly = !"history".equalsIgnoreCase(type);
        AuthUser auth = AuthContext.current();
        Map<String, Object> data = orderService.listUserOrders(auth.getUserId(), activeOnly, page == null ? 1 : page, pageSize == null ? 20 : pageSize);
        return withSuccess(data);
    }

    @GetMapping("/my-groups")
    public Map<String, Object> listMyOrderGroups(@RequestParam(required = false) String type,
                                                 @RequestParam(required = false) Integer page,
                                                 @RequestParam(required = false) Integer pageSize) {
        boolean activeOnly = !"history".equalsIgnoreCase(type);
        AuthUser auth = AuthContext.current();
        Map<String, Object> data = orderService.listUserOrderGroups(auth.getUserId(), activeOnly, page == null ? 1 : page, pageSize == null ? 20 : pageSize);
        return withSuccess(data);
    }

    @GetMapping("/groups/{orderGroupId}")
    public Map<String, Object> getByOrderGroupId(@PathVariable String orderGroupId) {
        AuthUser auth = AuthContext.current();
        Map<String, Object> data = parentOrderService.getOrderGroupForUser(orderGroupId, auth.getUserId(), auth.getRole());
        return Map.of("success", true, "data", data);
    }

    @PostMapping("/groups/{orderGroupId}/cancel")
    public Map<String, Object> cancelOrderGroup(@PathVariable String orderGroupId) {
        AuthUser auth = AuthContext.current();
        Map<String, Object> data = orderService.cancelOrderGroup(orderGroupId, auth.getUserId(), auth.getRole());
        return Map.of("success", true, "data", data);
    }

    @PostMapping("/groups/{orderGroupId}/refund/initiate")
    public Map<String, Object> initiateGroupRefund(@PathVariable String orderGroupId) {
        AuthUser auth = AuthContext.current();
        Map<String, Object> data = orderService.initiateGroupRefund(orderGroupId, auth.getUserId(), auth.getRole());
        return Map.of("success", true, "data", data);
    }

    @PostMapping("/groups/{orderGroupId}/refund/settle")
    public Map<String, Object> settleGroupRefund(@PathVariable String orderGroupId, @RequestBody(required = false) Map<String, Object> body) {
        AuthUser auth = AuthContext.current();
        Map<String, Object> data = orderService.settleGroupRefund(orderGroupId, auth.getUserId(), auth.getRole(), body == null ? "" : str(body.get("refundReferenceId")));
        return Map.of("success", true, "data", data);
    }

    @GetMapping("/{orderId}")
    public Map<String, Object> getByOrderId(@PathVariable String orderId) {
        AuthUser auth = AuthContext.current();
        Order order = orderService.getOrderForActor(orderId, auth.getUserId(), auth.getRole());
        return Map.of("success", true, "data", order);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> placeOrder(@RequestBody Map<String, Object> body) {
        AuthUser auth = AuthContext.current();
        Map<String, Object> data = orderService.createPendingOrder(
                auth.getUserId(),
                castMap(body.get("shippingAddress")),
                str(body.get("deliverySlotId")),
                str(body.get("paymentMethod")),
                str(body.get("couponCode"))
        );
        return ResponseEntity.status(201).body(Map.of("success", true, "data", data));
    }

    @PostMapping("/{orderId}/confirm-payment")
    public Map<String, Object> confirmPayment(@PathVariable String orderId, @RequestBody(required = false) Map<String, Object> body) {
        AuthUser auth = AuthContext.current();
        Order order = orderService.confirmPayment(
                orderId,
                body == null ? "" : str(body.get("paymentGatewayOrderId")),
                body == null ? "" : str(body.get("paymentGatewayPaymentId")),
                auth.getUserId(),
                auth.getRole()
        );
        return Map.of("success", true, "data", order);
    }

    @PatchMapping("/{orderId}/status")
    public Map<String, Object> updateStatus(@PathVariable String orderId, @RequestBody Map<String, Object> body) {
        AuthUser auth = AuthContext.current();
        Order order = orderService.transitionOrderStatus(
                orderId,
                str(body.get("nextStatus")),
                auth.getUserId(),
                auth.getRole(),
                str(body.get("deliveryOtp")),
                str(body.get("trackingId"))
        );
        return Map.of("success", true, "data", order);
    }

    private Map<String, Object> withSuccess(Map<String, Object> data) {
        java.util.Map<String, Object> out = new java.util.HashMap<>();
        out.put("success", true);
        out.putAll(data);
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
