package com.groceryapp.controller;

import com.groceryapp.service.OfferService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/offers")
public class OfferController {
    private final OfferService offerService;

    public OfferController(OfferService offerService) {
        this.offerService = offerService;
    }

    @GetMapping
    public Map<String, Object> getOffersPage() {
        return Map.of("success", true, "data", offerService.getOffersPageData());
    }

    @GetMapping("/help-content")
    public Map<String, Object> getHelpContent() {
        return Map.of("success", true, "data", offerService.getHelpContent());
    }
}
