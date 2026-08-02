package com.groceryapp.controller;

import com.groceryapp.security.AuthContext;
import com.groceryapp.service.AccountService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/account")
public class AccountController {
    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping("/me")
    public Map<String, Object> getProfile() {
        return Map.of("success", true, "data", accountService.getProfile(AuthContext.current().getUserId()));
    }

    @PatchMapping("/me")
    public Map<String, Object> updateProfile(@RequestBody Map<String, Object> body) {
        return Map.of("success", true, "data", accountService.updateProfile(AuthContext.current().getUserId(), body));
    }

    @PatchMapping("/me/notifications")
    public Map<String, Object> updateNotifications(@RequestBody Map<String, Object> body) {
        return Map.of("success", true, "data", accountService.updateNotifications(AuthContext.current().getUserId(), body));
    }

    @PutMapping("/me/addresses")
    public Map<String, Object> updateAddresses(@RequestBody Map<String, Object> body) {
        return Map.of("success", true, "data", accountService.updateAddresses(AuthContext.current().getUserId(), castAddressRows(body.get("addresses"))));
    }

    @GetMapping("/me/sessions")
    public Map<String, Object> listSessions() {
        return Map.of("success", true, "data", accountService.listSessions(AuthContext.current().getUserId()));
    }

    @PatchMapping("/me/two-factor")
    public Map<String, Object> setTwoFactor(@RequestBody Map<String, Object> body) {
        return Map.of("success", true, "data", accountService.setTwoFactor(AuthContext.current().getUserId(), bool(body.get("enabled"))));
    }

    @GetMapping("/me/cards")
    public Map<String, Object> listSavedCards() {
        return Map.of("success", true, "data", accountService.listSavedCards(AuthContext.current().getUserId()));
    }

    @PostMapping("/me/cards")
    public Map<String, Object> addSavedCard(@RequestBody Map<String, Object> body) {
        return Map.of("success", true, "data", accountService.addSavedCard(AuthContext.current().getUserId(), body));
    }

    @DeleteMapping("/me/cards/{cardId}")
    public Map<String, Object> removeSavedCard(@PathVariable String cardId) {
        return Map.of("success", true, "data", accountService.removeSavedCard(AuthContext.current().getUserId(), cardId));
    }

    @PatchMapping("/me/cards/{cardId}/default")
    public Map<String, Object> setDefaultCard(@PathVariable String cardId) {
        return Map.of("success", true, "data", accountService.setDefaultCard(AuthContext.current().getUserId(), cardId));
    }

    @PostMapping("/me/change-password")
    public Map<String, Object> changePassword(@RequestBody Map<String, Object> body) {
        accountService.changePassword(
                AuthContext.current().getUserId(),
                str(body.get("currentPassword")),
                str(body.get("newPassword"))
        );
        return Map.of("success", true, "message", "Password changed successfully");
    }

    @PostMapping("/me/logout-all")
    public Map<String, Object> logoutAllDevices() {
        accountService.logoutAllDevices(AuthContext.current().getUserId());
        return Map.of("success", true, "message", "Logged out from all devices");
    }

    @PostMapping("/me/data-download")
    public Map<String, Object> requestDataDownload() {
        accountService.requestDataDownload(AuthContext.current().getUserId());
        return Map.of("success", true, "message", "Data download request submitted");
    }

    @PostMapping("/me/profile-otp/request")
    public Map<String, Object> requestProfileOtp(@RequestBody Map<String, Object> body) {
        accountService.requestProfileOtp(AuthContext.current().getUserId(), str(body.get("type")), str(body.get("value")));
        return Map.of("success", true, "message", "OTP sent successfully");
    }

    @PostMapping("/me/profile-otp/verify")
    public Map<String, Object> verifyProfileOtp(@RequestBody Map<String, Object> body) {
        accountService.verifyProfileOtp(
                AuthContext.current().getUserId(),
                str(body.get("type")),
                str(body.get("value")),
                str(body.get("otp"))
        );
        return Map.of("success", true, "message", "OTP verified successfully");
    }

    @PostMapping("/me/delete-request")
    public Map<String, Object> requestDeletion() {
        accountService.requestDeletion(AuthContext.current().getUserId());
        return Map.of("success", true, "message", "Account deletion requested");
    }

    @PostMapping("/me/recently-viewed")
    public Map<String, Object> addRecentlyViewed(@RequestBody Map<String, Object> body) {
        accountService.addRecentlyViewed(AuthContext.current().getUserId(), str(body.get("productId")));
        return Map.of("success", true, "message", "Recently viewed updated");
    }

    @GetMapping("/me/recently-viewed")
    public Map<String, Object> listRecentlyViewed() {
        return Map.of("success", true, "data", accountService.listRecentlyViewed(AuthContext.current().getUserId()));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castAddressRows(Object v) {
        if (v instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return List.of();
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private boolean bool(Object v) {
        if (v instanceof Boolean b) return b;
        return "true".equalsIgnoreCase(str(v)) || "1".equals(str(v));
    }
}
