package com.groceryapp.repository;

import com.groceryapp.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, String>, JpaSpecificationExecutor<Order> {
    Optional<Order> findByOrderId(String orderId);

    long countByUserId(String userId);

    List<Order> findByOrderGroupIdOrderByCreatedAtAsc(String orderGroupId);

    List<Order> findTop200ByOrderStatusAndCreatedAtLessThanEqual(String orderStatus, Instant cutoff);
}
