package com.groceryapp.repository;

import com.groceryapp.model.ImportJob;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImportJobRepository extends JpaRepository<ImportJob, String> {
}
