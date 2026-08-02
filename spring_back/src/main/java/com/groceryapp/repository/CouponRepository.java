package com.groceryapp.repository;

import com.groceryapp.model.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, String> {
    Optional<Coupon> findByCodeAndIsActive(String code, Boolean isActive);
}
