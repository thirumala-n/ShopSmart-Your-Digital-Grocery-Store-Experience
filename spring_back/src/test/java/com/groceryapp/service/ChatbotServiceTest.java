package com.groceryapp.service;

import com.groceryapp.config.AppProperties;
import com.groceryapp.dto.ChatbotRequest;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChatbotServiceTest {
    @Test
    void shouldCreateServiceBean() {
        ChatbotService service = new ChatbotService(new AppProperties(), RestClient.builder());
        assertNotNull(service);
    }

    @Test
    void answersQuestions() {
        ChatbotService service = new ChatbotService(new AppProperties(), RestClient.builder());
        String reply = service.answer("Where is my order?");
        assertNotNull(reply);
    }

    @Test
    void returnsFallbackWhenAiIsNotConfigured() {
        ChatbotService service = new ChatbotService(new AppProperties(), RestClient.builder());
        ChatbotRequest request = new ChatbotRequest("How do payments work?", java.util.List.of());

        var response = service.answer(request);

        assertTrue(response.isSuccess());
        assertNotNull(response.getReply());
        assertTrue(response.getSource().equals("fallback"));
    }
}
