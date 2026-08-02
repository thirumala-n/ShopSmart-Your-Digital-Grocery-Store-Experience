package com.groceryapp.util;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.UUID;

public final class IdGenerator {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final HexFormat HEX = HexFormat.of();

    private IdGenerator() {
    }

    private static String token(int bytes) {
        byte[] buf = new byte[bytes];
        RANDOM.nextBytes(buf);
        return HEX.formatHex(buf).toUpperCase();
    }

    public static String createOrderId() {
        return "ORD" + token(10);
    }

    public static String createOrderGroupId() {
        return "GRP" + token(10);
    }

    public static String createTrackingId() {
        return "TRK" + token(8);
    }

    public static String createUuidCompact() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    public static String createObjectIdLike() {
        byte[] buf = new byte[12];
        RANDOM.nextBytes(buf);
        return HexFormat.of().formatHex(buf);
    }
}
