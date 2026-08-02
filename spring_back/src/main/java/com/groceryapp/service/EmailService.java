package com.groceryapp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
public class EmailService {
    public Map<String, Object> sendEmail(String to, String subject, String text, String html) {
        String host = System.getenv("SMTP_HOST");
        String user = System.getenv("SMTP_USER");
        String pass = System.getenv("SMTP_PASS");
        if (host == null || host.isBlank() || user == null || user.isBlank() || pass == null || pass.isBlank()) {
            log.warn("SMTP not configured. Email skipped for {}: {}", to, subject);
            return Map.of("queued", false);
        }
        // External SMTP transport can be plugged in here.
        log.info("Email queued to {} with subject {}", to, subject);
        return Map.of("queued", true);
    }
}
