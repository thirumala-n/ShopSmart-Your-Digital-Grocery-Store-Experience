package com.groceryapp.service;

import com.groceryapp.model.AuditLog;
import com.groceryapp.repository.AuditLogRepository;
import com.groceryapp.util.PaginationUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AuditLogService {
    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public AuditLog createAuditLog(
            String action,
            String performedBy,
            String targetType,
            String targetId,
            Object previousValue,
            Object newValue,
            HttpServletRequest request
    ) {
        AuditLog row = AuditLog.builder()
                .action(action)
                .performedBy(performedBy)
                .targetType(targetType)
                .targetId(targetId)
                .previousValue(previousValue)
                .newValue(newValue)
                .ip(request == null ? "" : str(request.getRemoteAddr()))
                .userAgent(request == null ? "" : str(request.getHeader("User-Agent")))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        return auditLogRepository.save(row);
    }

    public Map<String, Object> listAuditLogs(Integer pageRaw, Integer pageSizeRaw) {
        int page = PaginationUtil.page(pageRaw);
        int pageSize = PaginationUtil.pageSize(pageSizeRaw);
        Page<AuditLog> result = auditLogRepository.findAll(PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<AuditLog> items = result.getContent();
        long total = result.getTotalElements();

        Map<String, Object> out = new HashMap<>();
        out.put("items", items);
        out.put("total", total);
        out.put("page", page);
        out.put("pageSize", pageSize);
        out.put("totalPages", Math.ceil(total / (double) pageSize) == 0 ? 1 : (int) Math.ceil(total / (double) pageSize));
        return out;
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
