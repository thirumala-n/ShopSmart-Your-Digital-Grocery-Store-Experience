package com.groceryapp.controller;

import com.groceryapp.service.ReportService;
import com.groceryapp.util.CsvUtil;
import com.groceryapp.util.PdfUtil;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/sales")
    public Map<String, Object> salesReport(@RequestParam(required = false) String fromDate,
                                           @RequestParam(required = false) String toDate) {
        return Map.of("success", true, "data", reportService.getSalesReport(fromDate, toDate));
    }

    @GetMapping("/revenue")
    public Map<String, Object> revenueReport(@RequestParam(required = false) String fromDate,
                                             @RequestParam(required = false) String toDate) {
        return Map.of("success", true, "data", reportService.getRevenueReport(fromDate, toDate));
    }

    @GetMapping("/product-performance")
    public Map<String, Object> productPerformanceReport() {
        List<Map<String, Object>> data = reportService.getProductPerformanceReport();
        return Map.of(
                "success", true,
                "data", data,
                "items", data,
                "total", data.size(),
                "page", 1,
                "pageSize", data.size(),
                "totalPages", 1
        );
    }

    @GetMapping("/customer-growth")
    public Map<String, Object> customerGrowthReport(@RequestParam(required = false) String fromDate,
                                                    @RequestParam(required = false) String toDate) {
        return Map.of("success", true, "data", reportService.getCustomerGrowthReport(fromDate, toDate));
    }

    @GetMapping("/sales/export")
    public ResponseEntity<String> exportSalesCsv(@RequestParam(required = false) String fromDate,
                                                 @RequestParam(required = false) String toDate) {
        Map<String, Object> data = reportService.getSalesReport(fromDate, toDate);
        String csv = CsvUtil.toCsv(
                List.of("totalOrders", "totalRevenue", "totalUnits", "averageOrderValue"),
                List.of(Map.of(
                        "totalOrders", data.get("totalOrders"),
                        "totalRevenue", data.get("totalRevenue"),
                        "totalUnits", data.get("totalUnits"),
                        "averageOrderValue", data.get("averageOrderValue")
                ))
        );
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"sales_report.csv\"")
                .body(csv);
    }

    @GetMapping("/sales/export-pdf")
    public ResponseEntity<byte[]> exportSalesPdf(@RequestParam(required = false) String fromDate,
                                                 @RequestParam(required = false) String toDate) {
        Map<String, Object> data = reportService.getSalesReport(fromDate, toDate);
        List<String> lines = new ArrayList<>();
        lines.add("Total Orders: " + data.getOrDefault("totalOrders", 0));
        lines.add("Total Revenue: INR " + data.getOrDefault("totalRevenue", 0));
        lines.add("Total Units: " + data.getOrDefault("totalUnits", 0));
        lines.add("Average Order Value: INR " + data.getOrDefault("averageOrderValue", 0));
        lines.add("By Seller:");
        for (Map<String, Object> row : castMapList(data.get("bySeller"))) {
            lines.add("Seller: " + row.get("_id") + " | Orders: " + row.get("totalOrders") + " | Revenue: INR " + row.get("totalRevenue"));
        }
        byte[] pdf = PdfUtil.simpleTextPdf("Sales Report", lines);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"sales_report.pdf\"")
                .body(pdf);
    }

    @GetMapping("/revenue/export")
    public ResponseEntity<String> exportRevenueCsv(@RequestParam(required = false) String fromDate,
                                                   @RequestParam(required = false) String toDate) {
        Map<String, Object> data = reportService.getRevenueReport(fromDate, toDate);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> item : castMapList(data.get("dailyRevenueSeries"))) {
            Map<String, Object> id = castMap(item.get("_id"));
            String date = intVal(id.get("year")) + "-"
                    + String.format("%02d", intVal(id.get("month"))) + "-"
                    + String.format("%02d", intVal(id.get("day")));
            rows.add(Map.of("date", date, "revenue", item.get("revenue")));
        }
        String csv = CsvUtil.toCsv(List.of("date", "revenue"), rows);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"revenue_report.csv\"")
                .body(csv);
    }

    @GetMapping("/customer-growth/export")
    public ResponseEntity<String> exportCustomerGrowthCsv(@RequestParam(required = false) String fromDate,
                                                          @RequestParam(required = false) String toDate) {
        Map<String, Object> data = reportService.getCustomerGrowthReport(fromDate, toDate);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> item : castMapList(data.get("registrations"))) {
            Map<String, Object> id = castMap(item.get("_id"));
            String date = intVal(id.get("year")) + "-"
                    + String.format("%02d", intVal(id.get("month"))) + "-"
                    + String.format("%02d", intVal(id.get("day")));
            rows.add(Map.of("date", date, "count", item.get("count")));
        }
        String csv = CsvUtil.toCsv(List.of("date", "count"), rows);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"customer_growth_report.csv\"")
                .body(csv);
    }

    @GetMapping("/product-performance/export")
    public ResponseEntity<String> exportProductPerformanceCsv() {
        List<Map<String, Object>> data = reportService.getProductPerformanceReport();
        String csv = CsvUtil.toCsv(
                List.of("name", "sku", "totalUnitsSold", "totalRevenue", "averageRating", "returnRate"),
                data.stream().map(row -> Map.of(
                        "name", row.get("name"),
                        "sku", row.get("sku"),
                        "totalUnitsSold", row.get("totalUnitsSold"),
                        "totalRevenue", row.get("totalRevenue"),
                        "averageRating", row.get("averageRating"),
                        "returnRate", row.get("returnRate")
                )).toList()
        );
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"product_performance_report.csv\"")
                .body(csv);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castMapList(Object value) {
        if (value instanceof List<?> list) return (List<Map<String, Object>>) list;
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Object value) {
        if (value instanceof Map<?, ?> map) return (Map<String, Object>) map;
        return Map.of();
    }

    private int intVal(Object value) {
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ex) {
            return 0;
        }
    }
}
