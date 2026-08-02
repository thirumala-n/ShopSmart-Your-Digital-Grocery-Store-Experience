package com.groceryapp.controller;

import com.groceryapp.dto.ApiResponse;
import com.groceryapp.security.AuthContext;
import com.groceryapp.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, Object> body) {
        Map<String, Object> user = authService.register(body);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", user));
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, Object> body) {
        Map<String, Object> data = authService.login(body);
        Map<String, Object> out = new HashMap<>();
        out.put("success", true);
        out.put("token", data.get("token"));
        out.put("user", data.get("user"));
        out.put("data", data);
        return out;
    }

    @PostMapping("/refresh")
    public Map<String, Object> refresh(@RequestBody Map<String, Object> body) {
        Map<String, Object> data = authService.refresh(body);
        return Map.of("success", true, "data", data);
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(@RequestBody Map<String, Object> body) {
        ApiResponse<Void> res = authService.logout(AuthContext.current().getUserId(), body);
        return Map.of("success", res.isSuccess(), "message", res.getMessage());
    }

    @PostMapping("/logout-all")
    public Map<String, Object> logoutAll() {
        ApiResponse<Void> res = authService.logoutAll(AuthContext.current().getUserId());
        return Map.of("success", res.isSuccess(), "message", res.getMessage());
    }
}
