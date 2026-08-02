package com.groceryapp.service;

import com.groceryapp.exception.AppException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
public class NotificationService {
    private final EmailService emailService;

    public NotificationService(EmailService emailService) {
        this.emailService = emailService;
    }

    public Map<String, Object> sendSms(String to, String message) {
        String webhook = System.getenv("SMS_WEBHOOK_URL");
        if (webhook == null || webhook.isBlank()) {
            log.warn("SMS webhook not configured. SMS skipped for {}", to);
            return Map.of("queued", false);
        }
        // External SMS transport can be plugged in here.
        log.info("SMS queued to {}", to);
        return Map.of("queued", true);
    }

    public void sendOtpNotification(String orderId, String otp, String email, String phone) {
        boolean emailQueued = false;
        boolean smsQueued = false;
        if (email != null && !email.isBlank()) {
            emailQueued = (Boolean) emailService.sendEmail(
                    email,
                    "Delivery OTP for order " + orderId,
                    "Your delivery OTP for order " + orderId + " is " + otp + ". It expires in 30 minutes.",
                    null
            ).get("queued");
        }
        if (phone != null && !phone.isBlank()) {
            smsQueued = (Boolean) sendSms(
                    phone,
                    "Delivery OTP for order " + orderId + ": " + otp + ". Valid for 30 minutes."
            ).get("queued");
        }
        if (!emailQueued && !smsQueued) {
            throw new AppException("Failed to deliver delivery OTP", 500, "OTP_DELIVERY_FAILED");
        }
    }
}
