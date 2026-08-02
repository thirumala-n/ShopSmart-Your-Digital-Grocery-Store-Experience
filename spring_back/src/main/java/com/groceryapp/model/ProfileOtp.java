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
@Table(name = "profile_otps")
public class ProfileOtp {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    @Column(name = "user_id")
    private String userId;
    private String purpose;
    private String targetValue;
    private String otpHash;
    private Integer attempts;
    private Instant expiresAt;
    private Instant verifiedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
