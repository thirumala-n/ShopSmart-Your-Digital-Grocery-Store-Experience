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

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "audit_logs")
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    @Column(name = "action")
    private String action;
    @Column(name = "performed_by")
    private String performedBy;
    @Column(name = "target_type")
    private String targetType;
    @Column(name = "target_id")
    private String targetId;
    private Object previousValue;
    private Object newValue;
    private String ip;
    private String userAgent;
    private Instant createdAt;
    private Instant updatedAt;
}
