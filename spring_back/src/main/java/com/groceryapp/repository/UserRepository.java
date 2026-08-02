package com.groceryapp.repository;

import com.groceryapp.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByPhone(String phone);

    long countByAccountStatus(String accountStatus);

    List<User> findTop200ByAccountStatusAndPrivacySettingsDeleteRequestedAtLessThanEqual(String accountStatus, Instant cutoff);
}
