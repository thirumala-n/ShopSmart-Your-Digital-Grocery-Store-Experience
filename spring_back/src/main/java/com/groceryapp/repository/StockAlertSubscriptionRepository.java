package com.groceryapp.repository;

import com.groceryapp.model.StockAlertSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StockAlertSubscriptionRepository extends JpaRepository<StockAlertSubscription, String> {
    Optional<StockAlertSubscription> findByUserIdAndProductId(String userId, String productId);
}
