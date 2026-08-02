package com.groceryapp.controller;

import com.groceryapp.dto.ChatbotRequest;
import com.groceryapp.dto.ChatbotResponse;
import com.groceryapp.service.ChatbotService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chatbot")
public class ChatbotController {
    private final ChatbotService chatbotService;

    public ChatbotController(ChatbotService chatbotService) {
        this.chatbotService = chatbotService;
    }

    @PostMapping
    public ChatbotResponse chat(@Valid @RequestBody ChatbotRequest request) {
        return chatbotService.answer(request);
    }
}
