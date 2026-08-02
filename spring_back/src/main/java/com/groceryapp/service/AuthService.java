package com.groceryapp.service;

import com.groceryapp.dto.ApiResponse;
import com.groceryapp.exception.AppException;
import com.groceryapp.model.User;
import com.groceryapp.repository.UserRepository;
import com.groceryapp.security.JwtService;
import com.groceryapp.util.CryptoUtil;
import com.groceryapp.util.Roles;
import io.jsonwebtoken.Claims;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public Map<String, Object> register(Map<String, Object> payload) {
        String name = str(payload.get("name"));
        String email = str(payload.get("email")).toLowerCase();
        String phone = str(payload.get("phone"));
        String password = str(payload.get("password"));

        if (name.length() < 2 || email.isBlank() || phone.length() < 10 || password.length() < 8) {
            throw new AppException("Validation failed", 422, "VALIDATION_FAILED");
        }
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new AppException("Email already registered", 409, "EMAIL_EXISTS");
        }
        if (userRepository.findByPhone(phone).isPresent()) {
            throw new AppException("Phone already registered", 409, "PHONE_EXISTS");
        }

        Instant now = Instant.now();
        User user = User.builder()
                .name(name)
                .email(email)
                .phone(phone)
                .passwordHash(passwordEncoder.encode(password))
                .role(Roles.CUSTOMER)
                .accountStatus("ACTIVE")
                .profileImage("")
                .addresses(new ArrayList<>())
                .savedCards(new ArrayList<>())
                .refreshTokens(new ArrayList<>())
                .twoFactorEnabled(false)
                .failedLoginAttempts(0)
                .blockReason("")
                .createdAt(now)
                .updatedAt(now)
                .build();
        user = userRepository.save(user);
        return sanitizeUser(user);
    }

    public Map<String, Object> login(Map<String, Object> payload) {
        String email = str(payload.get("email")).toLowerCase();
        String password = str(payload.get("password"));

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new AppException("Invalid email or password", 401, "INVALID_CREDENTIALS"));

        if (!"ACTIVE".equalsIgnoreCase(user.getAccountStatus())) {
            throw new AppException("Account is not active", 403, "ACCOUNT_INACTIVE");
        }
        if (user.getLoginLockedUntil() != null && user.getLoginLockedUntil().isAfter(Instant.now())) {
            throw new AppException("Account temporarily locked for 15 minutes", 423, "ACCOUNT_LOCKED");
        }
        if (!passwordEncoder.matches(password, str(user.getPasswordHash()))) {
            int failed = (user.getFailedLoginAttempts() == null ? 0 : user.getFailedLoginAttempts()) + 1;
            user.setFailedLoginAttempts(failed);
            if (failed >= 5) {
                user.setLoginLockedUntil(Instant.now().plusSeconds(15 * 60));
            }
            user.setUpdatedAt(Instant.now());
            userRepository.save(user);
            throw new AppException("Invalid email or password", 401, "INVALID_CREDENTIALS");
        }

        user.setFailedLoginAttempts(0);
        user.setLoginLockedUntil(null);
        user.setLastLogin(Instant.now());
        String accessToken = jwtService.signAccessToken(user);
        String refreshToken = jwtService.signRefreshToken(user);
        List<String> refreshTokens = user.getRefreshTokens() == null ? new ArrayList<>() : new ArrayList<>(user.getRefreshTokens());
        refreshTokens.add(CryptoUtil.sha256(refreshToken));
        user.setRefreshTokens(refreshTokens);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        Map<String, Object> data = new HashMap<>();
        data.put("user", sanitizeUser(user));
        data.put("token", accessToken);
        data.put("accessToken", accessToken);
        data.put("refreshToken", refreshToken);
        return data;
    }

    public Map<String, Object> refresh(Map<String, Object> payload) {
        String refreshToken = str(payload.get("refreshToken"));
        Claims claims;
        try {
            claims = jwtService.verifyRefreshToken(refreshToken);
        } catch (Exception ex) {
            throw new AppException("Invalid refresh token", 401, "TOKEN_INVALID");
        }

        String userId = claims.getSubject();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("Invalid refresh token", 401, "TOKEN_INVALID"));

        if (!"ACTIVE".equalsIgnoreCase(user.getAccountStatus())) {
            throw new AppException("Invalid refresh token", 401, "TOKEN_INVALID");
        }
        List<String> tokens = user.getRefreshTokens() == null ? new ArrayList<>() : new ArrayList<>(user.getRefreshTokens());
        String oldHash = CryptoUtil.sha256(refreshToken);
        int idx = tokens.indexOf(oldHash);
        if (idx < 0) {
            throw new AppException("Refresh token revoked", 401, "TOKEN_REVOKED");
        }

        String newAccess = jwtService.signAccessToken(user);
        String newRefresh = jwtService.signRefreshToken(user);
        tokens.set(idx, CryptoUtil.sha256(newRefresh));
        user.setRefreshTokens(tokens);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        return Map.of("accessToken", newAccess, "refreshToken", newRefresh);
    }

    public ApiResponse<Void> logout(String userId, Map<String, Object> payload) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ApiResponse.<Void>builder().success(true).message("Logged out").build();
        }
        String refreshToken = str(payload.get("refreshToken"));
        String hash = CryptoUtil.sha256(refreshToken);
        User user = userOpt.get();
        List<String> tokens = user.getRefreshTokens() == null ? new ArrayList<>() : new ArrayList<>(user.getRefreshTokens());
        tokens.removeIf(t -> t.equals(hash));
        user.setRefreshTokens(tokens);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        return ApiResponse.<Void>builder().success(true).message("Logged out").build();
    }

    public ApiResponse<Void> logoutAll(String userId) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setRefreshTokens(new ArrayList<>());
            user.setUpdatedAt(Instant.now());
            userRepository.save(user);
        });
        return ApiResponse.<Void>builder().success(true).message("Logged out from all devices").build();
    }

    public Map<String, Object> sanitizeUser(User user) {
        Map<String, Object> out = new HashMap<>();
        out.put("id", user.getId());
        out.put("name", user.getName());
        out.put("email", user.getEmail());
        out.put("phone", user.getPhone());
        out.put("role", user.getRole());
        out.put("accountStatus", user.getAccountStatus());
        return out;
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
