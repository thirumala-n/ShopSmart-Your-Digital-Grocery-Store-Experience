package com.groceryapp.service;

import com.groceryapp.exception.AppException;
import com.groceryapp.model.Product;
import com.groceryapp.model.ProfileOtp;
import com.groceryapp.model.RecentlyViewed;
import com.groceryapp.model.User;
import com.groceryapp.repository.ProductRepository;
import com.groceryapp.repository.ProfileOtpRepository;
import com.groceryapp.repository.RecentlyViewedRepository;
import com.groceryapp.repository.UserRepository;
import com.groceryapp.util.CryptoUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class AccountService {
    private final UserRepository userRepository;
    private final RecentlyViewedRepository recentlyViewedRepository;
    private final ProfileOtpRepository profileOtpRepository;
    private final ProductRepository productRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final NotificationService notificationService;

    public AccountService(
            UserRepository userRepository,
            RecentlyViewedRepository recentlyViewedRepository,
            ProfileOtpRepository profileOtpRepository,
            ProductRepository productRepository,
            PasswordEncoder passwordEncoder,
            EmailService emailService,
            NotificationService notificationService
    ) {
        this.userRepository = userRepository;
        this.recentlyViewedRepository = recentlyViewedRepository;
        this.profileOtpRepository = profileOtpRepository;
        this.productRepository = productRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.notificationService = notificationService;
    }

    public Map<String, Object> getProfile(String userId) {
        User user = requireUser(userId);
        return toPublicProfile(user);
    }

    public Map<String, Object> updateProfile(String userId, Map<String, Object> payload) {
        User user = requireUser(userId);

        String name = str(payload.get("name"));
        String email = str(payload.get("email")).toLowerCase(Locale.ROOT);
        String phone = str(payload.get("phone"));

        if (!name.isBlank()) {
            user.setName(name);
        }
        if (!email.isBlank() && !email.equalsIgnoreCase(str(user.getEmail()))) {
            assertProfileOtpVerified(userId, "EMAIL_CHANGE", email);
            userRepository.findByEmailIgnoreCase(email).ifPresent(other -> {
                if (!Objects.equals(other.getId(), userId)) {
                    throw new AppException("Email already registered", 409, "EMAIL_EXISTS");
                }
            });
            user.setEmail(email);
        }
        if (!phone.isBlank() && !phone.equals(str(user.getPhone()))) {
            assertProfileOtpVerified(userId, "PHONE_CHANGE", phone);
            userRepository.findByPhone(phone).ifPresent(other -> {
                if (!Objects.equals(other.getId(), userId)) {
                    throw new AppException("Phone already registered", 409, "PHONE_EXISTS");
                }
            });
            user.setPhone(phone);
        }
        if (payload.containsKey("profileImage")) {
            user.setProfileImage(str(payload.get("profileImage")));
        }
        user.setUpdatedAt(Instant.now());
        user = userRepository.save(user);
        return toPublicProfile(user);
    }

    public Map<String, Object> updateNotifications(String userId, Map<String, Object> payload) {
        User user = requireUser(userId);
        User.NotificationPreferences prefs = user.getNotificationPreferences() == null
                ? new User.NotificationPreferences()
                : user.getNotificationPreferences();
        if (payload.containsKey("emailOrders")) prefs.setEmailOrders(bool(payload.get("emailOrders")));
        if (payload.containsKey("emailPromotions")) prefs.setEmailPromotions(bool(payload.get("emailPromotions")));
        if (payload.containsKey("smsOrders")) prefs.setSmsOrders(bool(payload.get("smsOrders")));
        if (payload.containsKey("pushNotifications")) prefs.setPushNotifications(bool(payload.get("pushNotifications")));
        user.setNotificationPreferences(prefs);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        return mapOf("emailOrders", prefs.getEmailOrders(), "emailPromotions", prefs.getEmailPromotions(), "smsOrders", prefs.getSmsOrders(), "pushNotifications", prefs.getPushNotifications());
    }

    public List<Map<String, Object>> updateAddresses(String userId, List<Map<String, Object>> addresses) {
        User user = requireUser(userId);
        List<User.Address> normalized = new ArrayList<>();
        for (Map<String, Object> row : addresses) {
            normalized.add(User.Address.builder()
                    .addressId(str(row.getOrDefault("addressId", UUID.randomUUID().toString())))
                    .label(str(row.get("label")))
                    .fullName(str(row.get("fullName")))
                    .phone(str(row.get("phone")))
                    .line1(str(row.get("line1")))
                    .line2(str(row.get("line2")))
                    .city(str(row.get("city")))
                    .state(str(row.get("state")))
                    .pincode(str(row.get("pincode")))
                    .isDefault(bool(row.getOrDefault("isDefault", false)))
                    .build());
        }
        if (!normalized.isEmpty()) {
            long defaults = normalized.stream().filter(a -> Boolean.TRUE.equals(a.getIsDefault())).count();
            if (defaults == 0) {
                normalized.get(0).setIsDefault(true);
            } else if (defaults > 1) {
                boolean seen = false;
                for (User.Address a : normalized) {
                    if (Boolean.TRUE.equals(a.getIsDefault()) && !seen) {
                        seen = true;
                    } else {
                        a.setIsDefault(false);
                    }
                }
            }
        }
        user.setAddresses(normalized);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        return normalized.stream().map(this::addressToMap).toList();
    }

    public List<Object> listSessions(String userId) {
        User user = requireUser(userId);
        int tokenCount = user.getRefreshTokens() == null ? 0 : user.getRefreshTokens().size();
        int count = Math.max(tokenCount, 1);
        List<Object> sessions = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            sessions.add(mapOf(
                    "sessionId", "session_" + (i + 1),
                    "deviceName", i == 0 ? "Current Device" : "Device " + (i + 1),
                    "location", "Unknown",
                    "lastActiveAt", user.getLastLogin() == null ? user.getUpdatedAt() : user.getLastLogin(),
                    "isCurrent", i == 0
            ));
        }
        return sessions;
    }

    public Map<String, Object> setTwoFactor(String userId, boolean enabled) {
        User user = requireUser(userId);
        user.setTwoFactorEnabled(enabled);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        return mapOf("twoFactorEnabled", enabled);
    }

    public List<Map<String, Object>> listSavedCards(String userId) {
        User user = requireUser(userId);
        List<User.SavedCard> cards = user.getSavedCards() == null ? List.of() : user.getSavedCards();
        return cards.stream().map(this::cardToPublic).toList();
    }

    public List<Map<String, Object>> addSavedCard(String userId, Map<String, Object> payload) {
        User user = requireUser(userId);
        List<User.SavedCard> cards = user.getSavedCards() == null ? new ArrayList<>() : user.getSavedCards();
        String gatewayToken = str(payload.get("gatewayToken"));
        if (cards.stream().anyMatch(c -> Objects.equals(c.getGatewayToken(), gatewayToken))) {
            throw new AppException("Card already exists", 409, "CARD_EXISTS");
        }
        User.SavedCard card = User.SavedCard.builder()
                .cardId(UUID.randomUUID().toString())
                .last4(str(payload.get("last4")))
                .brand(str(payload.get("brand")))
                .expiryMonth(intVal(payload.get("expiryMonth"), 0))
                .expiryYear(intVal(payload.get("expiryYear"), 0))
                .gatewayToken(gatewayToken)
                .isDefault(bool(payload.getOrDefault("isDefault", false)))
                .build();
        cards.add(card);
        normalizeDefaultCards(cards);
        user.setSavedCards(cards);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        return cards.stream().map(this::cardToPublic).toList();
    }

    public List<Map<String, Object>> removeSavedCard(String userId, String cardId) {
        User user = requireUser(userId);
        List<User.SavedCard> cards = user.getSavedCards() == null ? new ArrayList<>() : user.getSavedCards();
        int before = cards.size();
        cards = cards.stream().filter(c -> !Objects.equals(c.getCardId(), cardId)).collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        if (cards.size() == before) {
            throw new AppException("Card not found", 404, "CARD_NOT_FOUND");
        }
        normalizeDefaultCards(cards);
        user.setSavedCards(cards);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        return cards.stream().map(this::cardToPublic).toList();
    }

    public List<Map<String, Object>> setDefaultCard(String userId, String cardId) {
        User user = requireUser(userId);
        List<User.SavedCard> cards = user.getSavedCards() == null ? new ArrayList<>() : user.getSavedCards();
        boolean found = false;
        for (User.SavedCard card : cards) {
            boolean isDefault = Objects.equals(card.getCardId(), cardId);
            if (isDefault) {
                found = true;
            }
            card.setIsDefault(isDefault);
        }
        if (!found) {
            throw new AppException("Card not found", 404, "CARD_NOT_FOUND");
        }
        user.setSavedCards(cards);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        return cards.stream().map(this::cardToPublic).toList();
    }

    public void changePassword(String userId, String currentPassword, String newPassword) {
        User user = requireUser(userId);
        if (!passwordEncoder.matches(currentPassword, str(user.getPasswordHash()))) {
            throw new AppException("Current password is incorrect", 400, "INVALID_PASSWORD");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
    }

    public void logoutAllDevices(String userId) {
        User user = requireUser(userId);
        user.setRefreshTokens(new ArrayList<>());
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
    }

    public void requestDataDownload(String userId) {
        User user = requireUser(userId);
        User.PrivacySettings privacy = user.getPrivacySettings() == null ? new User.PrivacySettings() : user.getPrivacySettings();
        privacy.setDataDownloadRequested(true);
        user.setPrivacySettings(privacy);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        emailService.sendEmail(user.getEmail(), "Data download request received", "Hi " + user.getName() + ", your data download request has been received and is being processed.", null);
    }

    public void requestProfileOtp(String userId, String type, String value) {
        String normalizedType = str(type).toLowerCase(Locale.ROOT);
        String purpose;
        String target;
        if ("email".equals(normalizedType)) {
            purpose = "EMAIL_CHANGE";
            target = str(value).toLowerCase(Locale.ROOT);
        } else if ("phone".equals(normalizedType)) {
            purpose = "PHONE_CHANGE";
            target = str(value);
        } else {
            throw new AppException("Invalid OTP type", 400, "INVALID_OTP_TYPE");
        }

        String otpRaw = CryptoUtil.numericOtp(6);
        ProfileOtp otp = ProfileOtp.builder()
                .userId(userId)
                .purpose(purpose)
                .targetValue(target)
                .otpHash(passwordEncoder.encode(otpRaw))
                .attempts(0)
                .expiresAt(Instant.now().plusSeconds(10 * 60))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        profileOtpRepository.save(otp);

        Map<String, Object> result;
        if ("EMAIL_CHANGE".equals(purpose)) {
            result = emailService.sendEmail(target, "Verify your email change", "Your OTP is " + otpRaw + ". It expires in 10 minutes.", null);
        } else {
            result = notificationService.sendSms(target, "Your OTP is " + otpRaw + ". It expires in 10 minutes.");
        }
        if (!(Boolean) result.getOrDefault("queued", false)) {
            throw new AppException("Failed to deliver OTP", 500, "OTP_DELIVERY_FAILED");
        }
    }

    public void verifyProfileOtp(String userId, String type, String value, String otpValue) {
        String normalizedType = str(type).toLowerCase(Locale.ROOT);
        String purpose;
        String target;
        if ("email".equals(normalizedType)) {
            purpose = "EMAIL_CHANGE";
            target = str(value).toLowerCase(Locale.ROOT);
        } else if ("phone".equals(normalizedType)) {
            purpose = "PHONE_CHANGE";
            target = str(value);
        } else {
            throw new AppException("Invalid OTP type", 400, "INVALID_OTP_TYPE");
        }

        ProfileOtp doc = findLatestActiveOtp(userId, purpose, target)
                .orElseThrow(() -> new AppException("OTP not found or expired", 400, "OTP_INVALID"));

        if (!passwordEncoder.matches(str(otpValue), str(doc.getOtpHash()))) {
            doc.setAttempts((doc.getAttempts() == null ? 0 : doc.getAttempts()) + 1);
            if (doc.getAttempts() >= 5) {
                doc.setExpiresAt(Instant.now());
            }
            doc.setUpdatedAt(Instant.now());
            profileOtpRepository.save(doc);
            throw new AppException("Invalid OTP", 400, "OTP_INVALID");
        }
        doc.setVerifiedAt(Instant.now());
        doc.setUpdatedAt(Instant.now());
        profileOtpRepository.save(doc);
    }

    public void requestDeletion(String userId) {
        User user = requireUser(userId);
        user.setAccountStatus("PENDING_DELETION");
        user.setRefreshTokens(new ArrayList<>());
        User.PrivacySettings privacy = user.getPrivacySettings() == null ? new User.PrivacySettings() : user.getPrivacySettings();
        privacy.setDeleteAccountRequested(true);
        privacy.setDeleteRequestedAt(Instant.now());
        user.setPrivacySettings(privacy);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
    }

    public void addRecentlyViewed(String userId, String productId) {
        RecentlyViewed doc = recentlyViewedRepository.findByUserId(userId).orElse(null);
        if (doc == null) {
            doc = RecentlyViewed.builder().userId(userId).productIds(new ArrayList<>()).updatedAt(Instant.now()).build();
        }
        List<String> ids = doc.getProductIds() == null ? new ArrayList<>() : new ArrayList<>(doc.getProductIds());
        ids.removeIf(id -> Objects.equals(id, productId));
        ids.add(0, productId);
        if (ids.size() > 20) {
            ids = new ArrayList<>(ids.subList(0, 20));
        }
        doc.setProductIds(ids);
        doc.setUpdatedAt(Instant.now());
        recentlyViewedRepository.save(doc);
    }

    public List<Object> listRecentlyViewed(String userId) {
        RecentlyViewed doc = recentlyViewedRepository.findByUserId(userId).orElse(null);
        if (doc == null || doc.getProductIds() == null || doc.getProductIds().isEmpty()) {
            return List.of();
        }
        Map<String, Product> products = productRepository.findByIdIn(doc.getProductIds()).stream()
                .collect(java.util.stream.Collectors.toMap(Product::getId, p -> p));
        List<Object> out = new ArrayList<>();
        for (String pid : doc.getProductIds()) {
            Product p = products.get(pid);
            if (p == null) {
                continue;
            }
            out.add(mapOf(
                    "_id", p.getId(),
                    "name", p.getName(),
                    "slug", p.getSlug(),
                    "brand", p.getBrand(),
                    "images", p.getImages(),
                    "variants", p.getVariants(),
                    "rating", p.getRating(),
                    "totalReviews", p.getTotalReviews()
            ));
        }
        return out;
    }

    public int anonymizeDueAccounts() {
        Instant cutoff = Instant.now().minusSeconds(30L * 24 * 60 * 60);
        List<User> due = userRepository.findTop200ByAccountStatusAndPrivacySettingsDeleteRequestedAtLessThanEqual("PENDING_DELETION", cutoff);
        for (User user : due) {
            user.setName("Deleted User " + user.getId().substring(Math.max(0, user.getId().length() - 6)));
            user.setEmail("deleted_" + user.getId() + "@anonymized.local");
            user.setPhone("000000" + user.getId().substring(Math.max(0, user.getId().length() - 4)));
            user.setProfileImage("");
            user.setAddresses(new ArrayList<>());
            user.setSavedCards(new ArrayList<>());
            user.setNotificationPreferences(User.NotificationPreferences.builder()
                    .emailOrders(false)
                    .emailPromotions(false)
                    .smsOrders(false)
                    .pushNotifications(false)
                    .build());
            user.setRefreshTokens(new ArrayList<>());
            user.setBlockReason("");
            user.setAccountStatus("DELETED");
            user.setUpdatedAt(Instant.now());
            userRepository.save(user);
        }
        return due.size();
    }

    private void assertProfileOtpVerified(String userId, String purpose, String targetValue) {
        Instant since = Instant.now().minusSeconds(15 * 60);
        List<ProfileOtp> list = profileOtpRepository.findByUserIdAndPurposeAndTargetValueOrderByCreatedAtDesc(userId, purpose, targetValue);
        boolean ok = list.stream().anyMatch(doc -> doc.getVerifiedAt() != null && doc.getVerifiedAt().isAfter(since));
        if (!ok) {
            throw new AppException(("EMAIL_CHANGE".equals(purpose) ? "Email" : "Phone") + " OTP verification required", 400, "EMAIL_CHANGE".equals(purpose) ? "EMAIL_OTP_REQUIRED" : "PHONE_OTP_REQUIRED");
        }
    }

    private Optional<ProfileOtp> findLatestActiveOtp(String userId, String purpose, String targetValue) {
        List<ProfileOtp> list = profileOtpRepository.findByUserIdAndPurposeAndTargetValueOrderByCreatedAtDesc(userId, purpose, targetValue);
        Instant now = Instant.now();
        return list.stream().filter(doc -> doc.getVerifiedAt() == null && doc.getExpiresAt() != null && doc.getExpiresAt().isAfter(now)).findFirst();
    }

    private User requireUser(String userId) {
        return userRepository.findById(userId).orElseThrow(() -> new AppException("User not found", 404, "USER_NOT_FOUND"));
    }

    private Map<String, Object> toPublicProfile(User user) {
        Map<String, Object> out = new HashMap<>();
        out.put("_id", user.getId());
        out.put("name", user.getName());
        out.put("email", user.getEmail());
        out.put("phone", user.getPhone());
        out.put("role", user.getRole());
        out.put("profileImage", user.getProfileImage());
        out.put("addresses", user.getAddresses() == null ? List.of() : user.getAddresses().stream().map(this::addressToMap).toList());
        out.put("savedCards", listSavedCards(user.getId()));
        out.put("notificationPreferences", user.getNotificationPreferences());
        out.put("twoFactorEnabled", user.getTwoFactorEnabled());
        out.put("privacySettings", user.getPrivacySettings());
        out.put("accountStatus", user.getAccountStatus());
        out.put("blockReason", user.getBlockReason());
        out.put("lastLogin", user.getLastLogin());
        out.put("createdAt", user.getCreatedAt());
        out.put("updatedAt", user.getUpdatedAt());
        return out;
    }

    private Map<String, Object> addressToMap(User.Address a) {
        return mapOf(
                "addressId", a.getAddressId(),
                "label", a.getLabel(),
                "fullName", a.getFullName(),
                "phone", a.getPhone(),
                "line1", a.getLine1(),
                "line2", a.getLine2(),
                "city", a.getCity(),
                "state", a.getState(),
                "pincode", a.getPincode(),
                "isDefault", a.getIsDefault()
        );
    }

    private Map<String, Object> cardToPublic(User.SavedCard card) {
        return mapOf(
                "cardId", card.getCardId(),
                "last4", card.getLast4(),
                "brand", card.getBrand(),
                "expiryMonth", card.getExpiryMonth(),
                "expiryYear", card.getExpiryYear(),
                "isDefault", card.getIsDefault()
        );
    }

    private void normalizeDefaultCards(List<User.SavedCard> cards) {
        if (cards.isEmpty()) {
            return;
        }
        long defaults = cards.stream().filter(c -> Boolean.TRUE.equals(c.getIsDefault())).count();
        if (defaults == 0) {
            cards.get(0).setIsDefault(true);
            return;
        }
        if (defaults > 1) {
            boolean seen = false;
            for (User.SavedCard card : cards) {
                if (Boolean.TRUE.equals(card.getIsDefault()) && !seen) {
                    seen = true;
                } else {
                    card.setIsDefault(false);
                }
            }
        }
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private boolean bool(Object v) {
        if (v instanceof Boolean b) return b;
        return "true".equalsIgnoreCase(str(v)) || "1".equals(str(v));
    }

    private int intVal(Object v, int def) {
        try {
            return Integer.parseInt(str(v));
        } catch (Exception ignored) {
            return def;
        }
    }

    private Map<String, Object> mapOf(Object... kv) {
        Map<String, Object> out = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) out.put(String.valueOf(kv[i]), kv[i + 1]);
        return out;
    }
}
