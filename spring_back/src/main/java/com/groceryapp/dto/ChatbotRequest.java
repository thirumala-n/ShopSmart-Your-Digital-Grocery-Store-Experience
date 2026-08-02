package com.groceryapp.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatbotRequest {
    @NotBlank(message = "Message is required")
    @Size(max = 1000, message = "Message must be 1000 characters or fewer")
    private String message;

    @Valid
    @Size(max = 10, message = "History can include at most 10 messages")
    private List<ChatMessage> history = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessage {
        @NotBlank(message = "History role is required")
        private String role;

        @NotBlank(message = "History content is required")
        @Size(max = 1000, message = "History content must be 1000 characters or fewer")
        private String content;
    }
}
