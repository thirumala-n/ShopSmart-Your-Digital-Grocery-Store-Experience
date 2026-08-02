package com.groceryapp.controller;

import com.groceryapp.security.AuthContext;
import com.groceryapp.security.AuthUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/customer")
public class CustomerController {
    @GetMapping("/home")
    public Map<String, Object> home() {
        AuthUser auth = AuthContext.current();
        return Map.of(
                "success", true,
                "data", Map.of(
                        "role", auth.getRole(),
                        "userId", auth.getUserId()
                )
        );
    }
}
