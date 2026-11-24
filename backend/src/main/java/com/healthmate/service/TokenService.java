package com.healthmate.service;

import com.healthmate.database.DatabaseConnection;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Base64;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Generates and validates HMAC-SHA256 signed Bearer authentication tokens.
 * Ensures every protected API request accesses only the authenticated user's own data.
 */
@Service
public class TokenService {

    private static final long TOKEN_VALIDITY_MS = 7L * 24 * 60 * 60 * 1000; // 7 days
    private final DatabaseConnection databaseConnection;
    private final byte[] secretKeyBytes;
    private final Set<String> revokedTokens = ConcurrentHashMap.newKeySet();

    public TokenService(DatabaseConnection databaseConnection) {
        this.databaseConnection = databaseConnection;
        this.secretKeyBytes = loadOrCreateLocalSecret();
    }

    /**
     * Loads AUTH_TOKEN_SECRET from environment variables if set, or generates a local
     * random secret file (.local-token-secret) so no private secret is hardcoded in source code.
     */
    private byte[] loadOrCreateLocalSecret() {
        String envSecret = System.getenv("AUTH_TOKEN_SECRET");
        if (envSecret != null && envSecret.trim().length() >= 32) {
            return envSecret.trim().getBytes(StandardCharsets.UTF_8);
        }

        try {
            File secretFile = new File(".local-token-secret");
            if (secretFile.exists()) {
                String existing = Files.readString(secretFile.toPath(), StandardCharsets.UTF_8).trim();
                if (existing.length() >= 32) {
                    return existing.getBytes(StandardCharsets.UTF_8);
                }
            }

            byte[] randomBytes = new byte[32];
            new SecureRandom().nextBytes(randomBytes);
            StringBuilder hex = new StringBuilder();
            for (byte b : randomBytes) {
                hex.append(String.format("%02x", b));
            }
            String generated = hex.toString();
            Files.writeString(secretFile.toPath(), generated, StandardCharsets.UTF_8);
            return generated.getBytes(StandardCharsets.UTF_8);
        } catch (Exception e) {
            byte[] fallback = new byte[32];
            new SecureRandom().nextBytes(fallback);
            return fallback;
        }
    }

    /**
     * Creates a signed token for a logged-in user: base64(payload).base64(hmacSignature)
     */
    public String generateToken(int userId) {
        long issuedAt = System.currentTimeMillis();
        long expiresAt = issuedAt + TOKEN_VALIDITY_MS;
        String payload = userId + ":" + issuedAt + ":" + expiresAt;

        String payloadBase64 = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        String signatureBase64 = computeHmacBase64(payloadBase64);

        return payloadBase64 + "." + signatureBase64;
    }

    /**
     * Validates the Authorization Bearer header and returns the authenticated user's ID.
     */
    public int validateAndGetUserId(String authorizationHeader) {
        String token = extractBearerToken(authorizationHeader);
        if (token == null) {
            throw new SecurityException("Missing or invalid Authorization Bearer header.");
        }

        if (revokedTokens.contains(token)) {
            throw new SecurityException("Session token has been logged out. Please log in again.");
        }

        String[] parts = token.split("\\.");
        if (parts.length != 2) {
            throw new SecurityException("Invalid authentication token format.");
        }

        String payloadBase64 = parts[0];
        String providedSignature = parts[1];
        String expectedSignature = computeHmacBase64(payloadBase64);

        boolean validSignature = MessageDigest.isEqual(
                providedSignature.getBytes(StandardCharsets.UTF_8),
                expectedSignature.getBytes(StandardCharsets.UTF_8)
        );
        if (!validSignature) {
            throw new SecurityException("Invalid authentication token signature.");
        }

        String payload;
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(payloadBase64);
            payload = new String(decoded, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new SecurityException("Malformed authentication token payload.");
        }

        String[] fields = payload.split(":");
        if (fields.length != 3) {
            throw new SecurityException("Invalid authentication token claims.");
        }

        int userId;
        long expiresAt;
        try {
            userId = Integer.parseInt(fields[0]);
            expiresAt = Long.parseLong(fields[2]);
        } catch (NumberFormatException e) {
            throw new SecurityException("Invalid authentication token values.");
        }

        if (System.currentTimeMillis() > expiresAt) {
            throw new SecurityException("Authentication token has expired. Please log in again.");
        }

        if (!doesUserExist(userId)) {
            throw new SecurityException("Authenticated user account no longer exists.");
        }

        return userId;
    }

    /**
     * Revokes the active token when the user logs out.
     */
    public void revokeToken(String authorizationHeader) {
        String token = extractBearerToken(authorizationHeader);
        if (token != null) {
            revokedTokens.add(token);
        }
    }

    private String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null) {
            return null;
        }
        String trimmed = authorizationHeader.trim();
        if (!trimmed.startsWith("Bearer ")) {
            return null;
        }
        String token = trimmed.substring(7).trim();
        return token.isEmpty() ? null : token;
    }

    private String computeHmacBase64(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(secretKeyBytes, "HmacSHA256");
            mac.init(keySpec);
            byte[] hmacBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hmacBytes);
        } catch (Exception e) {
            throw new RuntimeException("Failed to sign authentication token.", e);
        }
    }

    private boolean doesUserExist(int userId) {
        String sql = "SELECT id FROM users WHERE id = ?;";
        try (Connection conn = databaseConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next();
            }
        } catch (Exception e) {
            return false;
        }
    }
}

