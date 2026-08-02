package com.groceryapp.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CacheService {
    private List<Object> lowStockData = new ArrayList<>();
    private Instant lowStockUpdatedAt;

    public synchronized Map<String, Object> getLowStockCache() {
        Map<String, Object> out = new HashMap<>();
        out.put("data", new ArrayList<>(lowStockData));
        out.put("updatedAt", lowStockUpdatedAt);
        return out;
    }

    public synchronized void setLowStockCache(List<Object> rows) {
        this.lowStockData = rows == null ? new ArrayList<>() : new ArrayList<>(rows);
        this.lowStockUpdatedAt = Instant.now();
    }
}
