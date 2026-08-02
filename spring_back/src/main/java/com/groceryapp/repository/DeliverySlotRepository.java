package com.groceryapp.repository;

import com.groceryapp.model.DeliverySlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface DeliverySlotRepository extends JpaRepository<DeliverySlot, String> {
    List<DeliverySlot> findByDateBetweenAndIsActiveOrderByDateAscTimeWindowAsc(Instant from, Instant to, Boolean isActive);
}
