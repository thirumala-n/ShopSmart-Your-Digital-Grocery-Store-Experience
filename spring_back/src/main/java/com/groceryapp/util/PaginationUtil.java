package com.groceryapp.util;

public final class PaginationUtil {
    private PaginationUtil() {
    }

    public static int page(Integer page) {
        return Math.max(1, page == null ? 1 : page);
    }

    public static int pageSize(Integer pageSize) {
        int pz = pageSize == null ? 20 : pageSize;
        return Math.max(1, Math.min(100, pz));
    }

    public static long skip(Integer page, Integer pageSize) {
        int p = page(page);
        int pz = pageSize(pageSize);
        return (long) (p - 1) * pz;
    }
}
