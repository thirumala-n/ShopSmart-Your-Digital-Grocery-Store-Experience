package com.groceryapp.repository;

import com.groceryapp.model.Wishlist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WishlistRepository extends JpaRepository<Wishlist, String> {
    Optional<Wishlist> findByUserId(String userId);
}
