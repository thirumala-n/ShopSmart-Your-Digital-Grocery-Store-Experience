package com.groceryapp.controller;

import com.groceryapp.model.DeliverySlot;
import com.groceryapp.model.SupportTicket;
import com.groceryapp.security.AuthContext;
import com.groceryapp.service.PublicService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/public")
public class PublicController {
    private final PublicService publicService;

    public PublicController(PublicService publicService) {
        this.publicService = publicService;
    }

    @GetMapping("/delivery-slots")
    public ResponseEntity<Map<String, Object>> listDeliverySlots() {
        java.util.List<DeliverySlot> slots = publicService.listDeliverySlots();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(Map.of(
                        "success", true,
                        "data", slots,
                        "items", slots,
                        "total", slots.size(),
                        "page", 1,
                        "pageSize", slots.size(),
                        "totalPages", 1
                ));
    }

    @GetMapping("/home-featured")
    public Map<String, Object> getHomeFeaturedConfig() {
        return Map.of("success", true, "data", publicService.getHomeFeaturedConfig());
    }

    @GetMapping("/delivery-availability/{pincode}")
    public Map<String, Object> checkDeliveryAvailability(@PathVariable String pincode) {
        return Map.of("success", true, "data", publicService.checkDeliveryAvailability(pincode));
    }

    @PostMapping("/newsletter")
    public ResponseEntity<Map<String, Object>> subscribeNewsletter(@RequestBody Map<String, Object> body) {
        PublicService.NewsletterSubscribeResult result = publicService.subscribeNewsletter(String.valueOf(body.get("email")));
        return ResponseEntity.status(result.created() ? 201 : 200).body(Map.of(
                "success", true,
                "data", Map.of("email", result.email(), "message", result.message())
        ));
    }

    @PostMapping("/support")
    public ResponseEntity<Map<String, Object>> createSupportTicket(@RequestBody Map<String, Object> body) {
        SupportTicket ticket = publicService.createSupportTicket(null, body);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", ticket));
    }

    @PostMapping("/support/authenticated")
    public ResponseEntity<Map<String, Object>> createSupportTicketAuthenticated(@RequestBody Map<String, Object> body) {
        SupportTicket ticket = publicService.createSupportTicket(AuthContext.current().getUserId(), body);
        return ResponseEntity.status(201).body(Map.of("success", true, "data", ticket));
    }
}
