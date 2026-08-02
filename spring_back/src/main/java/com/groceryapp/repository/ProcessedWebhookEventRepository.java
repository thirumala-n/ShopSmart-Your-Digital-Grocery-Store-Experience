package com.groceryapp.repository;

import com.groceryapp.model.ProcessedWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProcessedWebhookEventRepository extends JpaRepository<ProcessedWebhookEvent, String> {
    Optional<ProcessedWebhookEvent> findByEventId(String eventId);
}
