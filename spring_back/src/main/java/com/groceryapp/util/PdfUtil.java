package com.groceryapp.util;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public final class PdfUtil {
    private PdfUtil() {
    }

    public static byte[] simpleTextPdf(String title, List<String> lines) {
        StringBuilder content = new StringBuilder();
        content.append("BT\n");
        content.append("/F1 18 Tf\n");
        content.append("50 760 Td\n");
        content.append("(").append(escape(title)).append(") Tj\n");
        content.append("/F1 12 Tf\n");
        int yStep = 20;
        for (String line : lines) {
            content.append("0 -").append(yStep).append(" Td\n");
            content.append("(").append(escape(line)).append(") Tj\n");
        }
        content.append("ET");

        byte[] streamBytes = content.toString().getBytes(StandardCharsets.US_ASCII);

        List<byte[]> objects = new ArrayList<>();
        objects.add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n".getBytes(StandardCharsets.US_ASCII));
        objects.add("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n".getBytes(StandardCharsets.US_ASCII));
        objects.add(("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                + "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n").getBytes(StandardCharsets.US_ASCII));
        objects.add("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n".getBytes(StandardCharsets.US_ASCII));
        objects.add(("5 0 obj\n<< /Length " + streamBytes.length + " >>\nstream\n"
                + new String(streamBytes, StandardCharsets.US_ASCII) + "\nendstream\nendobj\n").getBytes(StandardCharsets.US_ASCII));

        String header = "%PDF-1.4\n";
        List<Integer> offsets = new ArrayList<>();
        int current = header.getBytes(StandardCharsets.US_ASCII).length;
        for (byte[] obj : objects) {
            offsets.add(current);
            current += obj.length;
        }

        StringBuilder xref = new StringBuilder();
        xref.append("xref\n0 ").append(objects.size() + 1).append("\n");
        xref.append("0000000000 65535 f \n");
        for (Integer offset : offsets) {
            xref.append(String.format("%010d 00000 n \n", offset));
        }
        String trailer = "trailer\n<< /Size " + (objects.size() + 1) + " /Root 1 0 R >>\nstartxref\n"
                + current + "\n%%EOF";

        byte[] xrefBytes = (xref + trailer).getBytes(StandardCharsets.US_ASCII);
        byte[] out = new byte[current + xrefBytes.length];
        int pos = 0;
        byte[] headerBytes = header.getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(headerBytes, 0, out, pos, headerBytes.length);
        pos += headerBytes.length;
        for (byte[] obj : objects) {
            System.arraycopy(obj, 0, out, pos, obj.length);
            pos += obj.length;
        }
        System.arraycopy(xrefBytes, 0, out, pos, xrefBytes.length);
        return out;
    }

    private static String escape(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace("(", "\\(")
                .replace(")", "\\)");
    }
}
