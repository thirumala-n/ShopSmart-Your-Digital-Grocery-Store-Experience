package com.groceryapp.service;

import com.groceryapp.config.AppProperties;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
public class PaymentGatewayService {
    private final AppProperties appProperties;

    public PaymentGatewayService(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    public Map<String, Object> createPaymentOrder(String orderId, double amount, String currency) {
        String provider = appProperties.getPaymentProvider();
        if ("MOCK".equalsIgnoreCase(provider)) {
            return Map.of(
                    "provider", "MOCK",
                    "externalOrderId", "mock_order_" + UUID.randomUUID(),
                    "amount", amount,
                    "currency", currency,
                    "paymentUrl", "/mock-payment?orderId=" + orderId
            );
        }
        return Map.of(
                "provider", provider,
                "externalOrderId", provider.toLowerCase() + "_" + UUID.randomUUID(),
                "amount", amount,
                "currency", currency,
                "paymentUrl", "/pay/" + provider.toLowerCase() + "/" + orderId
        );
    }

    public VerifiedWebhook verifyWebhook(Map<String, Object> payload, String signature, byte[] rawBody) {
        String provider = appProperties.getPaymentProvider();
        if ("MOCK".equalsIgnoreCase(provider)) {
            return new VerifiedWebhook(
                    true,
                    str(payload.getOrDefault("eventId", payload.getOrDefault("id", "mock_evt_" + UUID.randomUUID()))),
                    str(payload.getOrDefault("event", "payment.captured")),
                    str(payload.get("externalOrderId")),
                    str(payload.getOrDefault("externalPaymentId", "mock_pay_" + UUID.randomUUID())),
                    str(payload.getOrDefault("status", "CAPTURED")),
                    str(payload.getOrDefault("refundReferenceId", ""))
            );
        }
        String secret = appProperties.getPaymentWebhookSecret();
        if (secret == null || secret.isBlank() || signature == null || signature.isBlank() || rawBody == null) {
            return new VerifiedWebhook(false, "", "", "", "", "", "");
        }
        String expected = hmacSha256Hex(secret, rawBody);
        String normalized = signature.startsWith("sha256=") ? signature.substring("sha256=".length()) : signature;
        boolean ok = MessageDigest.isEqual(HexFormat.of().parseHex(expected), HexFormat.of().parseHex(normalized));
        return new VerifiedWebhook(
                ok,
                str(payload.getOrDefault("eventId", payload.getOrDefault("id", ""))),
                str(payload.getOrDefault("event", "payment.captured")),
                str(payload.get("externalOrderId")),
                str(payload.get("externalPaymentId")),
                str(payload.getOrDefault("status", "CAPTURED")),
                str(payload.getOrDefault("refundReferenceId", ""))
        );
    }

    public Map<String, Object> initiateRefund(String externalPaymentId, double amount) {
        return Map.of(
                "refundReferenceId", "refund_" + UUID.randomUUID(),
                "externalPaymentId", externalPaymentId,
                "amount", amount,
                "status", "REFUND_INITIATED"
        );
    }

    private String hmacSha256Hex(String secret, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] out = mac.doFinal(data);
            return HexFormat.of().formatHex(out);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to verify webhook", ex);
        }
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    public record VerifiedWebhook(
            boolean valid,
            String eventId,
            String event,
            String externalOrderId,
            String externalPaymentId,
            String status,
            String refundReferenceId
    ) {
    }
}
