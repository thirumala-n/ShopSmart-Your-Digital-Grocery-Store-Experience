package com.groceryapp.service;

import com.groceryapp.model.ImportJob;
import com.groceryapp.model.User;
import com.groceryapp.repository.ImportJobRepository;
import com.groceryapp.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class AdminImportService {
    private static final List<String> PRODUCT_CSV_TEMPLATE_HEADERS = List.of(
            "name", "slug", "SKU", "brand", "categoryId", "subCategoryId", "description",
            "weight", "price", "MRP", "stock", "isActive", "isFeatured", "sellerId"
    );
    private static final List<String> STOCK_CSV_TEMPLATE_HEADERS = List.of("productId", "variantId", "stock");

    private final ImportJobRepository importJobRepository;
    private final UserRepository userRepository;
    private final CatalogAdminService catalogAdminService;
    private final EmailService emailService;

    public AdminImportService(
            ImportJobRepository importJobRepository,
            UserRepository userRepository,
            CatalogAdminService catalogAdminService,
            EmailService emailService
    ) {
        this.importJobRepository = importJobRepository;
        this.userRepository = userRepository;
        this.catalogAdminService = catalogAdminService;
        this.emailService = emailService;
    }

    public ImportJob createProductCsvImportJob(String csvContent, String actorUserId) {
        Instant now = Instant.now();
        ImportJob job = ImportJob.builder()
                .jobType("PRODUCT_CSV")
                .status("PENDING")
                .createdBy(actorUserId)
                .totalRows(0)
                .processedRows(0)
                .successRows(0)
                .failedRows(0)
                .failureReport(new ArrayList<>())
                .notificationSent(false)
                .errorMessage("")
                .createdAt(now)
                .updatedAt(now)
                .build();
        job = importJobRepository.save(job);
        final String jobId = job.getId();
        CompletableFuture.runAsync(() -> processProductCsvImport(jobId, csvContent, actorUserId));
        return job;
    }

    public ImportJob createStockCsvImportJob(String csvContent, String actorUserId) {
        Instant now = Instant.now();
        ImportJob job = ImportJob.builder()
                .jobType("STOCK_CSV")
                .status("PENDING")
                .createdBy(actorUserId)
                .totalRows(0)
                .processedRows(0)
                .successRows(0)
                .failedRows(0)
                .failureReport(new ArrayList<>())
                .notificationSent(false)
                .errorMessage("")
                .createdAt(now)
                .updatedAt(now)
                .build();
        job = importJobRepository.save(job);
        final String jobId = job.getId();
        CompletableFuture.runAsync(() -> processStockCsvImport(jobId, csvContent, actorUserId));
        return job;
    }

    public ImportJob getImportJobStatus(String jobId) {
        return importJobRepository.findById(jobId).orElse(null);
    }

    public String getProductCsvTemplate() {
        return String.join(",", PRODUCT_CSV_TEMPLATE_HEADERS) + "\n";
    }

    public String getStockCsvTemplate() {
        return String.join(",", STOCK_CSV_TEMPLATE_HEADERS) + "\n";
    }

    private void processProductCsvImport(String jobId, String csvContent, String actorUserId) {
        ImportJob job = importJobRepository.findById(jobId).orElse(null);
        if (job == null) return;

        job.setStatus("RUNNING");
        job.setStartedAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        importJobRepository.save(job);

        try {
            CsvData parsed = parseCsv(csvContent);
            List<String> headers = parsed.headers();
            List<List<String>> rows = parsed.rows();
            job.setTotalRows(rows.size());
            importJobRepository.save(job);

            for (int i = 0; i < rows.size(); i++) {
                int rowNumber = i + 2;
                try {
                    Map<String, String> values = rowToMap(headers, rows.get(i));
                    if (blank(values.get("name")) || blank(values.get("slug")) || blank(values.get("SKU"))
                            || blank(values.get("brand")) || blank(values.get("categoryId"))
                            || blank(values.get("subCategoryId")) || blank(values.get("weight"))) {
                        throw new IllegalArgumentException("Missing required columns");
                    }
                    double price = parseDouble(values.get("price"));
                    double mrp = parseDouble(values.get("MRP"));
                    int stock = (int) parseDouble(values.get("stock"));

                    Map<String, Object> payload = new HashMap<>();
                    payload.put("name", values.get("name"));
                    payload.put("slug", values.get("slug"));
                    payload.put("SKU", values.get("SKU"));
                    payload.put("brand", values.get("brand"));
                    payload.put("categoryId", values.get("categoryId"));
                    payload.put("subCategoryId", values.get("subCategoryId"));
                    payload.put("sellerId", blank(values.get("sellerId")) ? actorUserId : values.get("sellerId"));
                    payload.put("description", values.getOrDefault("description", ""));
                    payload.put("isActive", parseBoolean(values.get("isActive"), true));
                    payload.put("isFeatured", parseBoolean(values.get("isFeatured"), false));
                    payload.put("images", List.of("https://placehold.co/800x800?text=Product"));
                    payload.put("tags", List.of(values.get("brand")));
                    payload.put("variants", List.of(Map.of(
                            "weight", values.get("weight"),
                            "price", price,
                            "MRP", mrp,
                            "stock", stock,
                            "skuSuffix", values.get("SKU") + "-1"
                    )));
                    catalogAdminService.upsertProduct(payload, actorUserId);
                    job.setSuccessRows(job.getSuccessRows() + 1);
                } catch (Exception ex) {
                    job.setFailedRows(job.getFailedRows() + 1);
                    List<ImportJob.Failure> failures = job.getFailureReport() == null ? new ArrayList<>() : job.getFailureReport();
                    failures.add(ImportJob.Failure.builder()
                            .rowNumber(rowNumber)
                            .reason(msg(ex))
                            .build());
                    job.setFailureReport(failures);
                } finally {
                    job.setProcessedRows(job.getProcessedRows() + 1);
                    if (job.getProcessedRows() % 10 == 0 || Objects.equals(job.getProcessedRows(), job.getTotalRows())) {
                        job.setUpdatedAt(Instant.now());
                        importJobRepository.save(job);
                    }
                }
            }

            job.setStatus("COMPLETED");
            job.setCompletedAt(Instant.now());
            job.setUpdatedAt(Instant.now());
            importJobRepository.save(job);
        } catch (Exception ex) {
            job.setStatus("FAILED");
            job.setErrorMessage(msg(ex));
            job.setCompletedAt(Instant.now());
            job.setUpdatedAt(Instant.now());
            importJobRepository.save(job);
        }

        notifyJobStatus(job, actorUserId, "Product CSV import");
    }

    private void processStockCsvImport(String jobId, String csvContent, String actorUserId) {
        ImportJob job = importJobRepository.findById(jobId).orElse(null);
        if (job == null) return;

        job.setStatus("RUNNING");
        job.setStartedAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        importJobRepository.save(job);

        try {
            CsvData parsed = parseCsv(csvContent);
            List<String> headers = parsed.headers();
            List<List<String>> rows = parsed.rows();
            job.setTotalRows(rows.size());
            importJobRepository.save(job);

            for (int i = 0; i < rows.size(); i++) {
                int rowNumber = i + 2;
                try {
                    Map<String, String> values = rowToMap(headers, rows.get(i));
                    if (blank(values.get("productId")) || blank(values.get("variantId"))) {
                        throw new IllegalArgumentException("Missing productId/variantId");
                    }
                    int stock = (int) parseDouble(values.get("stock"));
                    if (stock < 0) {
                        throw new IllegalArgumentException("Invalid stock");
                    }
                    catalogAdminService.updateVariantStock(
                            values.get("productId"),
                            values.get("variantId"),
                            stock,
                            actorUserId,
                            "ADMIN_BULK_STOCK_UPLOAD"
                    );
                    job.setSuccessRows(job.getSuccessRows() + 1);
                } catch (Exception ex) {
                    job.setFailedRows(job.getFailedRows() + 1);
                    List<ImportJob.Failure> failures = job.getFailureReport() == null ? new ArrayList<>() : job.getFailureReport();
                    failures.add(ImportJob.Failure.builder()
                            .rowNumber(rowNumber)
                            .reason(msg(ex))
                            .build());
                    job.setFailureReport(failures);
                } finally {
                    job.setProcessedRows(job.getProcessedRows() + 1);
                    if (job.getProcessedRows() % 10 == 0 || Objects.equals(job.getProcessedRows(), job.getTotalRows())) {
                        job.setUpdatedAt(Instant.now());
                        importJobRepository.save(job);
                    }
                }
            }
            job.setStatus("COMPLETED");
            job.setCompletedAt(Instant.now());
            job.setUpdatedAt(Instant.now());
            importJobRepository.save(job);
        } catch (Exception ex) {
            job.setStatus("FAILED");
            job.setErrorMessage(msg(ex));
            job.setCompletedAt(Instant.now());
            job.setUpdatedAt(Instant.now());
            importJobRepository.save(job);
        }

        notifyJobStatus(job, actorUserId, "Stock CSV import");
    }

    private void notifyJobStatus(ImportJob job, String actorUserId, String prefix) {
        User user = userRepository.findById(actorUserId).orElse(null);
        if (user != null && !blank(user.getEmail())) {
            emailService.sendEmail(
                    user.getEmail(),
                    prefix + " " + str(job.getStatus()).toLowerCase(Locale.ROOT),
                    "Import job " + job.getId() + " finished with status " + job.getStatus()
                            + ". Success: " + job.getSuccessRows() + ", Failed: " + job.getFailedRows() + ".",
                    null
            );
        }
        ImportJob saved = importJobRepository.findById(job.getId()).orElse(null);
        if (saved != null) {
            saved.setNotificationSent(true);
            saved.setUpdatedAt(Instant.now());
            importJobRepository.save(saved);
        }
    }

    private CsvData parseCsv(String csvContent) {
        List<String> lines = Arrays.stream(str(csvContent).split("\\r?\\n"))
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .toList();
        if (lines.isEmpty()) {
            return new CsvData(List.of(), List.of());
        }
        List<String> headers = Arrays.stream(lines.get(0).split(","))
                .map(String::trim)
                .toList();
        List<List<String>> rows = new ArrayList<>();
        for (int i = 1; i < lines.size(); i++) {
            rows.add(Arrays.stream(lines.get(i).split(","))
                    .map(String::trim)
                    .toList());
        }
        return new CsvData(headers, rows);
    }

    private Map<String, String> rowToMap(List<String> headers, List<String> row) {
        Map<String, String> values = new HashMap<>();
        for (int i = 0; i < headers.size(); i++) {
            values.put(headers.get(i), i < row.size() ? row.get(i) : "");
        }
        return values;
    }

    private boolean parseBoolean(String value, boolean defaultValue) {
        if (value == null || value.isBlank()) return defaultValue;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return List.of("1", "true", "yes", "y").contains(normalized);
    }

    private double parseDouble(String raw) {
        try {
            return Double.parseDouble(str(raw));
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid numeric fields");
        }
    }

    private boolean blank(String value) {
        return value == null || value.trim().isBlank();
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String msg(Exception ex) {
        return ex == null || ex.getMessage() == null || ex.getMessage().isBlank() ? "Import failed" : ex.getMessage();
    }

    private record CsvData(List<String> headers, List<List<String>> rows) {
    }
}
