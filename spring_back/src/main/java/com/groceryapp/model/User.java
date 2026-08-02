package com.groceryapp.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
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
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @NotBlank
    private String name;

    @Email
    @Column(unique = true)
    private String email;

    @Column(unique = true)
    private String phone;

    private String passwordHash;

    @Column(name = "role_name")
    private String role;

    private String profileImage;

    @ElementCollection
    @CollectionTable(name = "user_addresses", joinColumns = @JoinColumn(name = "user_id"))
    @Builder.Default
    private List<Address> addresses = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "user_saved_cards", joinColumns = @JoinColumn(name = "user_id"))
    @Builder.Default
    private List<SavedCard> savedCards = new ArrayList<>();

    @Embedded
    @Builder.Default
    private NotificationPreferences notificationPreferences = new NotificationPreferences();

    private Boolean twoFactorEnabled;

    @Embedded
    @Builder.Default
    private PrivacySettings privacySettings = new PrivacySettings();

    @Column(name = "account_status")
    private String accountStatus;

    private String blockReason;

    @ElementCollection
    @CollectionTable(name = "user_refresh_tokens", joinColumns = @JoinColumn(name = "user_id"))
    @Builder.Default
    private List<String> refreshTokens = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "user_recently_viewed", joinColumns = @JoinColumn(name = "user_id"))
    @Builder.Default
    private List<String> recentlyViewed = new ArrayList<>();

    private Integer failedLoginAttempts;
    private Instant loginLockedUntil;
    private Instant lastLogin;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Address {
        private String addressId;
        private String label;
        private String fullName;
        private String phone;
        private String line1;
        private String line2;
        private String city;
        private String state;
        private String pincode;
        private Boolean isDefault;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SavedCard {
        private String cardId;
        private String last4;
        private String brand;
        private Integer expiryMonth;
        private Integer expiryYear;
        private String gatewayToken;
        private Boolean isDefault;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NotificationPreferences {
        private Boolean emailOrders = true;
        private Boolean emailPromotions = true;
        private Boolean smsOrders = true;
        private Boolean pushNotifications = false;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PrivacySettings {
        private Boolean dataDownloadRequested = false;
        private Boolean deleteAccountRequested = false;
        private Instant deleteRequestedAt;
    }
}
