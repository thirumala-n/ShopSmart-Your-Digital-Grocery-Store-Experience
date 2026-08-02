package com.groceryapp.controller;

import com.groceryapp.exception.AppException;
import com.groceryapp.model.Banner;
import com.groceryapp.model.ImportJob;
import com.groceryapp.model.Product;
import com.groceryapp.security.AuthContext;
import com.groceryapp.service.AdminImportService;
import com.groceryapp.service.AdminService;
import com.groceryapp.util.CsvUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminService adminService;
    private final AdminImportService adminImportService;

    public AdminController(AdminService adminService, AdminImportService adminImportService) {
        this.adminService = adminService;
        this.adminImportService = adminImportService;
    }

    @GetMapping("/dashboard/metrics")
    public Map<String, Object> dashboardMetrics() {
        return Map.of("success", true, "data", adminService.dashboardMetrics());
    }

    @GetMapping("/dashboard/analytics")
    public Map<String, Object> dashboardAnalytics(@RequestParam Map<String, String> queryParams) {
        return Map.of("success", true, "data", adminService.dashboardAnalytics(queryParams));
    }

    @GetMapping("/orders")
    public Map<String, Object> listOrders(@RequestParam Map<String, String> queryParams) {
        return withSuccess(adminService.listOrders(queryParams));
    }

    @GetMapping("/inventory/low-stock")
    public Map<String, Object> lowStockAlerts(@RequestParam(required = false) String force) {
        Map<String, Object> data = adminService.lowStockAlerts("true".equalsIgnoreCase(force));
        return Map.of(
                "success", true,
                "data", data.get("data"),
                "items", data.get("items"),
                "total", data.get("total"),
                "page", data.get("page"),
                "pageSize", data.get("pageSize"),
                "totalPages", data.get("totalPages"),
                "updatedAt", data.get("updatedAt"),
                "source", data.get("source")
        );
    }

    @GetMapping("/inventory/movements")
    public Map<String, Object> listStockMovements(@RequestParam Map<String, String> queryParams) {
        return withSuccess(adminService.listStockMovements(queryParams));
    }

    @GetMapping("/users")
    public Map<String, Object> listUsers(@RequestParam Map<String, String> queryParams) {
        return withSuccess(adminService.listUsers(queryParams));
    }

    @GetMapping("/audit-logs")
    public Map<String, Object> listAuditLogs(@RequestParam Map<String, String> queryParams) {
        return withSuccess(adminService.listAuditLogs(queryParams));
    }

    @PatchMapping("/users/{id}/block")
    public Map<String, Object> blockUser(@PathVariable String id, @RequestBody Map<String, Object> body) {
        String message = adminService.blockUser(id, bool(body.get("block")), str(body.get("reason")));
        return Map.of("success", true, "message", message);
    }

    @PatchMapping("/users/{id}/role")
    public Map<String, Object> updateUserRole(@PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        Map<String, Object> data = adminService.updateUserRole(id, str(body.get("role")), AuthContext.current().getUserId(), request);
        return Map.of("success", true, "data", data);
    }

    @GetMapping("/products/csv-template")
    public ResponseEntity<String> productCsvTemplate() {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"product_template.csv\"")
                .body(adminImportService.getProductCsvTemplate());
    }

    @PostMapping("/products/bulk-upload")
    public ResponseEntity<Map<String, Object>> createProductCsvUploadJob(@RequestBody Map<String, Object> body) {
        ImportJob job = adminImportService.createProductCsvImportJob(str(body.get("csvContent")), AuthContext.current().getUserId());
        return ResponseEntity.status(202).body(Map.of(
                "success", true,
                "data", Map.of("jobId", job.getId(), "status", job.getStatus())
        ));
    }

    @GetMapping("/products/bulk-upload/{jobId}")
    public Map<String, Object> getProductCsvUploadJob(@PathVariable String jobId) {
        ImportJob data = adminImportService.getImportJobStatus(jobId);
        if (data == null) throw new AppException("Import job not found", 404, "IMPORT_JOB_NOT_FOUND");
        return Map.of("success", true, "data", data);
    }

    @GetMapping("/products/bulk-upload/{jobId}/failures")
    public ResponseEntity<String> getCsvUploadFailureReport(@PathVariable String jobId) {
        ImportJob data = adminImportService.getImportJobStatus(jobId);
        if (data == null) throw new AppException("Import job not found", 404, "IMPORT_JOB_NOT_FOUND");
        List<Map<String, Object>> rows = (data.getFailureReport() == null ? List.<com.groceryapp.model.ImportJob.Failure>of() : data.getFailureReport())
                .stream()
                .map(item -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("rowNumber", item.getRowNumber());
                    row.put("reason", item.getReason());
                    return row;
                })
                .toList();
        String csv = CsvUtil.toCsv(List.of("rowNumber", "reason"), rows);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"import_failures_" + jobId + ".csv\"")
                .body(csv);
    }

    @GetMapping("/inventory/stock-csv-template")
    public ResponseEntity<String> stockCsvTemplate() {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"stock_template.csv\"")
                .body(adminImportService.getStockCsvTemplate());
    }

    @PostMapping("/inventory/bulk-stock-upload")
    public ResponseEntity<Map<String, Object>> createStockCsvUploadJob(@RequestBody Map<String, Object> body) {
        ImportJob job = adminImportService.createStockCsvImportJob(str(body.get("csvContent")), AuthContext.current().getUserId());
        return ResponseEntity.status(202).body(Map.of(
                "success", true,
                "data", Map.of("jobId", job.getId(), "status", job.getStatus())
        ));
    }

    @PatchMapping("/inventory/threshold")
    public Map<String, Object> updateLowStockThreshold(@RequestBody Map<String, Object> body) {
        Product data = adminService.updateLowStockThreshold(str(body.get("productId")), intVal(body.get("threshold"), 0));
        return Map.of("success", true, "data", data);
    }

    @GetMapping("/products/pending-approval")
    public Map<String, Object> listPendingSellerProducts(@RequestParam Map<String, String> queryParams) {
        return withSuccess(adminService.listPendingSellerProducts(queryParams));
    }

    @PatchMapping("/products/{id}/review")
    public Map<String, Object> reviewSellerProduct(@PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        Product data = adminService.reviewSellerProduct(
                id,
                str(body.get("action")),
                str(body.get("note")),
                AuthContext.current().getUserId(),
                request
        );
        return Map.of("success", true, "data", data);
    }

    @GetMapping("/banners")
    public Map<String, Object> listBanners(@RequestParam Map<String, String> queryParams) {
        return withSuccess(adminService.listBanners(queryParams));
    }

    @PatchMapping("/banners/reorder")
    public Map<String, Object> reorderBanners(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        List<String> bannerIds = castStringList(body.get("bannerIds"));
        List<Banner> data = adminService.reorderBanners(bannerIds, AuthContext.current().getUserId(), request);
        return Map.of("success", true, "data", data);
    }

    @GetMapping("/home-featured")
    public Map<String, Object> getHomeFeaturedConfig() {
        return Map.of("success", true, "data", adminService.getHomeFeaturedConfig());
    }

    @PostMapping("/home-featured/upsert")
    public Map<String, Object> upsertHomeFeaturedConfig(@RequestBody Map<String, Object> body) {
        return Map.of("success", true, "data", adminService.upsertHomeFeaturedConfig(castMapList(body.get("items"))));
    }

    private Map<String, Object> withSuccess(Map<String, Object> data) {
        Map<String, Object> out = new HashMap<>();
        out.put("success", true);
        out.putAll(data);
        return out;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castMapList(Object value) {
        if (value instanceof List<?> list) return (List<Map<String, Object>>) list;
        return List.of();
    }

    private List<String> castStringList(Object value) {
        if (!(value instanceof List<?> rows)) return List.of();
        List<String> out = new ArrayList<>();
        for (Object row : rows) {
            String v = str(row);
            if (!v.isBlank()) out.add(v);
        }
        return out;
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private int intVal(Object v, int def) {
        try {
            return Integer.parseInt(str(v));
        } catch (Exception ex) {
            return def;
        }
    }

    private boolean bool(Object v) {
        if (v instanceof Boolean b) return b;
        return "true".equalsIgnoreCase(str(v)) || "1".equals(str(v));
    }
}
