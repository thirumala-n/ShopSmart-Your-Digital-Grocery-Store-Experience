package com.groceryapp.repository;

import com.groceryapp.model.Newsletter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NewsletterRepository extends JpaRepository<Newsletter, String> {
    Optional<Newsletter> findByEmail(String email);
}
