package com.groceryapp.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "import_jobs")
public class ImportJob {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    @Column(name = "job_type")
    private String jobType;
    @Column(name = "status")
    private String status;
    @Column(name = "created_by")
    private String createdBy;
    private Integer totalRows;
    private Integer processedRows;
    private Integer successRows;
    private Integer failedRows;
    @Builder.Default
    private List<Failure> failureReport = new ArrayList<>();
    private Boolean notificationSent;
    private Instant startedAt;
    private Instant completedAt;
    private String errorMessage;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Failure {
        private Integer rowNumber;
        private String reason;
    }
}
