package com.groceryapp.repository;

import com.groceryapp.model.SupportTicket;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, String> {
}
