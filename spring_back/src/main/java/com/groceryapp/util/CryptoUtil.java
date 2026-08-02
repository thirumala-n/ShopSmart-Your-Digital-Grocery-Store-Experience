package com.groceryapp.util;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

public final class CryptoUtil {
    private static final SecureRandom RANDOM = new SecureRandom();

    private CryptoUtil() {
    }

    public static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(String.valueOf(value).getBytes());
            StringBuilder out = new StringBuilder();
            for (byte b : bytes) {
                out.append(String.format("%02x", b));
            }
            return out.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    public static String numericOtp(int len) {
        StringBuilder otp = new StringBuilder();
        for (int i = 0; i < len; i++) {
            otp.append(RANDOM.nextInt(10));
        }
        return otp.toString();
    }
}
