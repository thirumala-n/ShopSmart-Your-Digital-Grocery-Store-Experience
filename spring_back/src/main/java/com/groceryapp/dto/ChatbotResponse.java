package com.groceryapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatbotResponse {
    private boolean success;
    private String reply;
    private String source;
    private String intent;
    private Object data;
}
