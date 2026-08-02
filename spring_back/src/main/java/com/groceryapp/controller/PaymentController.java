package com.groceryapp.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.groceryapp.exception.AppException;
import com.groceryapp.security.AuthContext;
import com.groceryapp.service.PaymentService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    private final PaymentService paymentService;
    private final ObjectMapper objectMapper;

    public PaymentController(PaymentService paymentService, ObjectMapper objectMapper) {
        this.paymentService = paymentService;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/create-order")
    public Map<String, Object> createGatewayOrder(@RequestBody Map<String, Object> body) {
        Map<String, Object> data = paymentService.createGatewayOrder(
                str(body.get("orderId")),
                AuthContext.current().getUserId(),
                str(body.get("idempotencyKey"))
        );
        return Map.of("success", true, "data", data);
    }

    @PostMapping(value = "/webhook", consumes = MediaType.ALL_VALUE)
    public Map<String, Object> webhook(
            @RequestBody(required = false) byte[] rawBody,
            @RequestHeader(value = "x-payment-signature", required = false) String signature
    ) {
        byte[] payloadBytes = rawBody == null ? new byte[0] : rawBody;
        Map<String, Object> payload;
        try {
            payload = payloadBytes.length == 0
                    ? java.util.Map.of()
                    : objectMapper.readValue(payloadBytes, objectMapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
        } catch (Exception ex) {
            throw new AppException("Invalid webhook payload", 400, "INVALID_WEBHOOK_PAYLOAD");
        }
        Map<String, Object> data = paymentService.handlePaymentWebhook(payload, str(signature), payloadBytes);
        return Map.of("success", true, "data", data);
    }

    @PostMapping("/refund")
    public Map<String, Object> initiateRefund(@RequestBody Map<String, Object> body) {
        Map<String, Object> data = paymentService.initiateRefund(
                str(body.get("orderId")),
                AuthContext.current().getUserId()
        );
        return Map.of("success", true, "data", data);
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
