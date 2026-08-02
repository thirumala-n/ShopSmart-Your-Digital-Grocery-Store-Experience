package com.groceryapp.repository;

import com.groceryapp.model.SeasonalSale;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface SeasonalSaleRepository extends JpaRepository<SeasonalSale, String> {
    List<SeasonalSale> findTop20ByIsActiveAndStartDateLessThanEqualAndEndDateGreaterThanEqual(Boolean isActive, Instant startDate, Instant endDate);
}
