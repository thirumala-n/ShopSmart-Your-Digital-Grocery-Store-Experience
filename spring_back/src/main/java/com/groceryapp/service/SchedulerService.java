package com.groceryapp.service;

import com.groceryapp.model.Order;
import com.groceryapp.repository.OrderRepository;
import com.groceryapp.util.OrderStatus;
import com.groceryapp.util.Roles;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
public class SchedulerService {
    private static final Logger log = LoggerFactory.getLogger(SchedulerService.class);

    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final InventoryService inventoryService;
    private final CacheService cacheService;
    private final AccountService accountService;

    public SchedulerService(
            OrderRepository orderRepository,
            OrderService orderService,
            InventoryService inventoryService,
            CacheService cacheService,
            AccountService accountService
    ) {
        this.orderRepository = orderRepository;
        this.orderService = orderService;
        this.inventoryService = inventoryService;
        this.cacheService = cacheService;
        this.accountService = accountService;
    }

    @Scheduled(fixedDelay = 60_000)
    public void cancelExpiredPendingPayments() {
        Instant cutoff = Instant.now().minusSeconds(15 * 60);
        List<Order> stale = orderRepository.findTop200ByOrderStatusAndCreatedAtLessThanEqual(OrderStatus.PENDING_PAYMENT, cutoff);
        for (Order order : stale) {
            try {
                orderService.transitionOrderStatus(
                        order.getOrderId(),
                        OrderStatus.CANCELLED,
                        order.getUserId(),
                        Roles.ADMIN,
                        null,
                        null
                );
            } catch (Exception ex) {
                log.warn("Failed to auto-cancel stale order {}: {}", order.getOrderId(), ex.getMessage());
            }
        }
    }

    @Scheduled(fixedDelay = 60 * 60 * 1000)
    public void refreshLowStockCache() {
        try {
            cacheService.setLowStockCache(inventoryService.scanLowStockVariants());
        } catch (Exception ex) {
            log.error("Low stock cache refresh failed: {}", ex.getMessage());
        }
    }

    @Scheduled(fixedDelay = 24 * 60 * 60 * 1000)
    public void runAccountAnonymization() {
        try {
            int count = accountService.anonymizeDueAccounts();
            log.info("Account anonymization completed. accounts={}", count);
        } catch (Exception ex) {
            log.error("Account anonymization job failed: {}", ex.getMessage());
        }
    }
}
