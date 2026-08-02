package com.groceryapp.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class CsvUtil {
    private CsvUtil() {
    }

    public static String toCsv(List<String> headers, List<Map<String, Object>> rows) {
        List<String> lines = new ArrayList<>();
        lines.add(String.join(",", headers.stream().map(CsvUtil::escape).toList()));
        for (Map<String, Object> row : rows) {
            List<String> cells = new ArrayList<>();
            for (String header : headers) {
                cells.add(escape(row.get(header)));
            }
            lines.add(String.join(",", cells));
        }
        return String.join("\n", lines);
    }

    private static String escape(Object value) {
        if (value == null) {
            return "";
        }
        String s = String.valueOf(value);
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
