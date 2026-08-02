package com.groceryapp.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "payment_transactions")
public class PaymentTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    @Column(name = "order_id")
    private String orderId;
    @Column(name = "external_order_id")
    private String externalOrderId;
    @Column(name = "external_payment_id")
    private String externalPaymentId;
    private Double amount;
    private String currency;
    private String gateway;
    @Column(name = "idempotency_key")
    private String idempotencyKey;
    @Column(name = "idempotency_expires_at")
    private Instant idempotencyExpiresAt;
    private String status;
    private String refundReferenceId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json")
    @Builder.Default
    private Map<String, Object> metadata = new HashMap<>();
    private Instant createdAt;
    private Instant updatedAt;
}
