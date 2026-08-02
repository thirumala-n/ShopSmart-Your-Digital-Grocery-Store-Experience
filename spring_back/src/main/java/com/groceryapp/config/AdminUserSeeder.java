package com.groceryapp.config;

import com.groceryapp.model.User;
import com.groceryapp.repository.UserRepository;
import com.groceryapp.util.Roles;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;

@Component
public class AdminUserSeeder implements ApplicationRunner {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminUserSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        String email = "nemberu14@gmail.com";
        String password = "nemberu@2274";

        try {
            userRepository.findByEmailIgnoreCase(email).ifPresentOrElse(user -> {
                user.setRole(Roles.ADMIN);
                user.setAccountStatus("ACTIVE");
                user.setPasswordHash(passwordEncoder.encode(password));
                user.setUpdatedAt(Instant.now());
                userRepository.save(user);
            }, () -> {
                Instant now = Instant.now();
                User admin = User.builder()
                        .name("Admin")
                        .email(email)
                        .phone("+250700000000")
                        .passwordHash(passwordEncoder.encode(password))
                        .role(Roles.ADMIN)
                        .accountStatus("ACTIVE")
                        .profileImage("")
                        .addresses(new ArrayList<>())
                        .savedCards(new ArrayList<>())
                        .refreshTokens(new ArrayList<>())
                        .twoFactorEnabled(false)
                        .failedLoginAttempts(0)
                        .blockReason("")
                        .createdAt(now)
                        .updatedAt(now)
                        .build();
                userRepository.save(admin);
            });
        } catch (DataAccessException ex) {
            System.out.println("Skipping admin seeding because the database is unavailable: " + ex.getMessage());
        }
    }
}
