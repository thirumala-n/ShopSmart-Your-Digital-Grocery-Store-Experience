package com.groceryapp.controller;

import com.groceryapp.model.Order;
import com.groceryapp.security.AuthContext;
import com.groceryapp.service.SellerOperationsService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/seller")
public class SellerController {
    private final SellerOperationsService sellerOperationsService;

    public SellerController(SellerOperationsService sellerOperationsService) {
        this.sellerOperationsService = sellerOperationsService;
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        return Map.of("success", true, "data", sellerOperationsService.getSellerDashboard(AuthContext.current().getUserId()));
    }

    @GetMapping("/analytics")
    public Map<String, Object> analytics(@RequestParam(required = false) String fromDate,
                                         @RequestParam(required = false) String toDate) {
        return Map.of("success", true, "data", sellerOperationsService.getSellerAnalytics(AuthContext.current().getUserId(), fromDate, toDate));
    }

    @GetMapping("/analytics/export")
    public ResponseEntity<String> analyticsExport(@RequestParam(required = false) String fromDate,
                                                  @RequestParam(required = false) String toDate) {
        String csv = sellerOperationsService.exportSellerSalesCsv(AuthContext.current().getUserId(), fromDate, toDate);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"seller_sales_report.csv\"")
                .body(csv);
    }

    @GetMapping("/orders")
    public Map<String, Object> listSellerOrders(@RequestParam(required = false) String status,
                                                @RequestParam(required = false) Integer page,
                                                @RequestParam(required = false) Integer pageSize) {
        Map<String, Object> data = sellerOperationsService.listSellerOrders(
                AuthContext.current().getUserId(),
                status,
                page == null ? 1 : page,
                pageSize == null ? 20 : pageSize
        );
        return withSuccess(data);
    }

    @GetMapping("/orders/{orderId}")
    public Map<String, Object> getSellerOrder(@PathVariable String orderId) {
        Order data = sellerOperationsService.getSellerOrderByOrderId(AuthContext.current().getUserId(), orderId);
        return Map.of("success", true, "data", data);
    }

    @GetMapping("/inventory/movements")
    public Map<String, Object> stockMovements(@RequestParam(required = false) Integer page,
                                              @RequestParam(required = false) Integer pageSize) {
        Map<String, Object> data = sellerOperationsService.listSellerStockMovements(
                AuthContext.current().getUserId(),
                page == null ? 1 : page,
                pageSize == null ? 20 : pageSize
        );
        return withSuccess(data);
    }

    private Map<String, Object> withSuccess(Map<String, Object> data) {
        Map<String, Object> out = new HashMap<>();
        out.put("success", true);
        out.putAll(data);
        return out;
    }
}
