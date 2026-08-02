package com.groceryapp.repository;

import com.groceryapp.model.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, String> {
    Optional<PaymentTransaction> findByIdempotencyKey(String idempotencyKey);

    Optional<PaymentTransaction> findFirstByExternalOrderId(String externalOrderId);

    List<PaymentTransaction> findByExternalOrderId(String externalOrderId);

    Optional<PaymentTransaction> findByOrderId(String orderId);

    Optional<PaymentTransaction> findByExternalPaymentId(String externalPaymentId);

    Optional<PaymentTransaction> findByRefundReferenceId(String refundReferenceId);
}
