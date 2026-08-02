package com.groceryapp.exception;

import com.groceryapp.dto.ErrorResponse;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.util.List;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ErrorResponse> handleApp(AppException ex) {
        return ResponseEntity.status(ex.getStatus()).body(
                ErrorResponse.builder()
                        .success(false)
                        .code(ex.getCode())
                        .message(ex.getMessage())
                        .details(ex.getDetails())
                        .build()
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        List<Map<String, Object>> details = ex.getBindingResult().getFieldErrors().stream()
                .map(this::fieldError)
                .toList();
        return ResponseEntity.unprocessableEntity().body(
                ErrorResponse.builder()
                        .success(false)
                        .code("VALIDATION_FAILED")
                        .message("Validation failed")
                        .details(details)
                        .build()
        );
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraint(ConstraintViolationException ex) {
        return ResponseEntity.unprocessableEntity().body(
                ErrorResponse.builder()
                        .success(false)
                        .code("VALIDATION_FAILED")
                        .message("Validation failed")
                        .details(ex.getMessage())
                        .build()
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                ErrorResponse.builder()
                        .success(false)
                        .code("FORBIDDEN")
                        .message("Forbidden")
                        .build()
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAny(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                ErrorResponse.builder()
                        .success(false)
                        .code("SERVER_ERROR")
                        .message(ex.getMessage() == null ? "Unexpected error" : ex.getMessage())
                        .build()
        );
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NoHandlerFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                ErrorResponse.builder()
                        .success(false)
                        .code("NOT_FOUND")
                        .message("Route not found")
                        .build()
        );
    }

    private Map<String, Object> fieldError(FieldError e) {
        return Map.of(
                "field", e.getField(),
                "message", e.getDefaultMessage() == null ? "Invalid value" : e.getDefaultMessage()
        );
    }
}
