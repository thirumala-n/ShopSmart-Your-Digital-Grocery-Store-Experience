package com.groceryapp.repository;

import com.groceryapp.model.ParentOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ParentOrderRepository extends JpaRepository<ParentOrder, String> {
    Optional<ParentOrder> findByOrderGroupId(String orderGroupId);
}
