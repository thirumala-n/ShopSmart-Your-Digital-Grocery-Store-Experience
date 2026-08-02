package com.groceryapp.repository;

import com.groceryapp.model.StockMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface StockMovementRepository extends JpaRepository<StockMovement, String>, JpaSpecificationExecutor<StockMovement> {
}
