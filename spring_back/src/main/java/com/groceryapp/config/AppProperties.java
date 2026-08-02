package com.groceryapp.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

@Data
@Configuration
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private Jwt jwt = new Jwt();
    private int bcryptSaltRounds = 12;
    private String corsWhitelist = "http://localhost:4200";
    private double defaultDeliveryFee = 40;
    private double freeDeliveryThreshold = 499;
    private double taxPercent = 5;
    private int lowStockDefaultThreshold = 10;
    private String paymentProvider = "MOCK";
    private String paymentWebhookSecret = "";
    private String frontendBaseUrl = "http://localhost:4200";
    private Ai ai = new Ai();

    public List<String> corsAllowedOrigins() {
        return Arrays.stream(String.valueOf(corsWhitelist).split(","))
                .map(String::trim)
                .filter(v -> !v.isEmpty())
                .toList();
    }

    @Data
    public static class Jwt {
        private String accessSecret;
        private String refreshSecret;
        private Duration accessTtl = Duration.ofMinutes(15);
        private Duration refreshTtl = Duration.ofDays(7);
    }

    @Data
    public static class Ai {
        private boolean enabled = false;
        private String provider = "OPENAI";
        private String apiKey = "";
        private String baseUrl = "https://api.openai.com/v1";
        private String model = "gpt-4o-mini";
        private Duration timeout = Duration.ofSeconds(20);
    }
}
