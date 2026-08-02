package com.groceryapp.security;

import com.groceryapp.config.AppProperties;
import com.groceryapp.model.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtService {
    private final AppProperties appProperties;

    public JwtService(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    public String signAccessToken(User user) {
        Instant now = Instant.now();
        SecretKey key = Keys.hmacShaKeyFor(appProperties.getJwt().getAccessSecret().getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(user.getId())
                .claims(Map.of(
                        "userId", user.getId(),
                        "role", user.getRole(),
                        "email", user.getEmail(),
                        "name", user.getName()
                ))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(appProperties.getJwt().getAccessTtl())))
                .signWith(key)
                .compact();
    }

    public String signRefreshToken(User user) {
        Instant now = Instant.now();
        SecretKey key = Keys.hmacShaKeyFor(appProperties.getJwt().getRefreshSecret().getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(user.getId())
                .claim("jti", UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(appProperties.getJwt().getRefreshTtl())))
                .signWith(key)
                .compact();
    }

    public Claims verifyAccessToken(String token) {
        SecretKey key = Keys.hmacShaKeyFor(appProperties.getJwt().getAccessSecret().getBytes(StandardCharsets.UTF_8));
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public Claims verifyRefreshToken(String token) {
        SecretKey key = Keys.hmacShaKeyFor(appProperties.getJwt().getRefreshSecret().getBytes(StandardCharsets.UTF_8));
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
