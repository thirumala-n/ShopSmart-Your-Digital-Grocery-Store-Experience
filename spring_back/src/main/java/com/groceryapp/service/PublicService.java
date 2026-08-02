package com.groceryapp.service;

import com.groceryapp.exception.AppException;
import com.groceryapp.model.DeliverySlot;
import com.groceryapp.model.HomeFeaturedConfig;
import com.groceryapp.model.Newsletter;
import com.groceryapp.model.SupportTicket;
import com.groceryapp.repository.DeliverySlotRepository;
import com.groceryapp.repository.HomeFeaturedConfigRepository;
import com.groceryapp.repository.NewsletterRepository;
import com.groceryapp.repository.SupportTicketRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class PublicService {
    private final NewsletterRepository newsletterRepository;
    private final SupportTicketRepository supportTicketRepository;
    private final DeliverySlotRepository deliverySlotRepository;
    private final HomeFeaturedConfigRepository homeFeaturedConfigRepository;
    private final EmailService emailService;

    public PublicService(
            NewsletterRepository newsletterRepository,
            SupportTicketRepository supportTicketRepository,
            DeliverySlotRepository deliverySlotRepository,
            HomeFeaturedConfigRepository homeFeaturedConfigRepository,
            EmailService emailService
    ) {
        this.newsletterRepository = newsletterRepository;
        this.supportTicketRepository = supportTicketRepository;
        this.deliverySlotRepository = deliverySlotRepository;
        this.homeFeaturedConfigRepository = homeFeaturedConfigRepository;
        this.emailService = emailService;
    }

    public NewsletterSubscribeResult subscribeNewsletter(String email) {
        String normalized = String.valueOf(email).toLowerCase(Locale.ROOT).trim();
        Optional<Newsletter> existing = newsletterRepository.findByEmail(normalized);
        boolean already = existing.isPresent();
        Newsletter doc = existing.orElseGet(() -> Newsletter.builder().email(normalized).subscribedAt(Instant.now()).build());
        doc.setIsActive(true);
        newsletterRepository.save(doc);
        return new NewsletterSubscribeResult(normalized, already ? "Email already subscribed" : "Subscription successful", !already);
    }

    public SupportTicket createSupportTicket(String userId, Map<String, Object> payload) {
        SupportTicket ticket = SupportTicket.builder()
                .userId(userId)
                .name(str(payload.get("name")))
                .email(str(payload.get("email")))
                .subject(str(payload.get("subject")))
                .category(str(payload.get("category")))
                .message(str(payload.get("message")))
                .status("OPEN")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        ticket = supportTicketRepository.save(ticket);
        emailService.sendEmail(
                ticket.getEmail(),
                "Support ticket received: " + ticket.getId(),
                "Hi " + ticket.getName() + ", we received your support request \"" + ticket.getSubject() + "\". Ticket ID: " + ticket.getId() + ".",
                null
        );
        return ticket;
    }

    public List<DeliverySlot> listDeliverySlots() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        Instant start = today.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant end = today.plusDays(6).atTime(23, 59, 59).toInstant(ZoneOffset.UTC);
        return deliverySlotRepository.findByDateBetweenAndIsActiveOrderByDateAscTimeWindowAsc(start, end, true);
    }

    public Map<String, Object> checkDeliveryAvailability(String pincode) {
        String pin = String.valueOf(pincode).trim();
        if (!pin.matches("^\\d{6}$")) {
            throw new AppException("Invalid pincode", 400, "PINCODE_INVALID");
        }
        String configuredRaw = Optional.ofNullable(System.getenv("SERVICEABLE_PINCODES")).orElse("");
        Set<String> serviceable = new HashSet<>();
        if (!configuredRaw.isBlank()) {
            for (String s : configuredRaw.split(",")) {
                if (!s.trim().isBlank()) {
                    serviceable.add(s.trim());
                }
            }
        } else {
            serviceable.addAll(List.of("110001", "110002", "110003", "560001", "560002", "400001", "400002", "700001", "700002"));
        }
        if (!serviceable.contains(pin)) {
            return Map.of(
                    "pincode", pin,
                    "serviceable", false,
                    "message", "Not Deliverable to this pincode"
            );
        }
        return Map.of(
                "pincode", pin,
                "serviceable", true,
                "expectedDeliveryDate", Instant.now().plusSeconds(24 * 60 * 60)
        );
    }

    public Map<String, Object> getHomeFeaturedConfig() {
        HomeFeaturedConfig config = homeFeaturedConfigRepository.findByKey("HOME_FEATURED").orElse(null);
        List<HomeFeaturedConfig.HomeFeaturedItem> items = config == null || config.getItems() == null ? List.of() : config.getItems().stream()
                .filter(i -> i != null && i.getProductId() != null)
                .sorted(Comparator.comparing(i -> i.getDisplayOrder() == null ? 0 : i.getDisplayOrder()))
                .toList();
        return Map.of("key", "HOME_FEATURED", "items", items);
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    public record NewsletterSubscribeResult(String email, String message, boolean created) {
    }
}
