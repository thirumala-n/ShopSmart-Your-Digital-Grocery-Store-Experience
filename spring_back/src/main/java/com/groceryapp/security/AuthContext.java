package com.groceryapp.security;

import com.groceryapp.exception.AppException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class AuthContext {
    private AuthContext() {
    }

    public static AuthUser current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthUser user)) {
            throw new AppException("Authentication required", 401, "AUTH_REQUIRED");
        }
        return user;
    }
}
