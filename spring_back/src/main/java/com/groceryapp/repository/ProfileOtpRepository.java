package com.groceryapp.repository;

import com.groceryapp.model.ProfileOtp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProfileOtpRepository extends JpaRepository<ProfileOtp, String> {
    List<ProfileOtp> findByUserIdAndPurposeAndTargetValueOrderByCreatedAtDesc(String userId, String purpose, String targetValue);
}
