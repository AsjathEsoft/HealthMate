package com.healthmate.controller;

import com.healthmate.database.DatabaseConnection;
import com.healthmate.model.User;
import com.healthmate.service.TokenService;
import com.healthmate.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * REST Controller for user registration, login, logout, current user lookup, and server health check.
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;
    private final TokenService tokenService;
    private final DatabaseConnection databaseConnection;

    public UserController(
            UserService userService,
            TokenService tokenService,
            DatabaseConnection databaseConnection
    ) {
        this.userService = userService;
        this.tokenService = tokenService;
        this.databaseConnection = databaseConnection;
    }

    /**
     * GET /api/health - Checks whether the Java backend and SQLite connection are online.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new LinkedHashMap<>();
        try (Connection ignored = databaseConnection.getConnection()) {
            response.put("status", "UP");
            response.put("database", "CONNECTED");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("status", "DOWN");
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * POST /api/auth/register - Creates a new user account and returns a signed Bearer token.
     */
    @PostMapping("/auth/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        try {
            String name = body.get("name");
            String email = body.get("email");
            String password = body.get("password");

            User user = userService.registerUser(name, email, password);
            String token = tokenService.generateToken(user.getId());

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("token", token);
            response.put("user", user);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not register user account.");
        }
    }

    /**
     * POST /api/auth/login - Verifies credentials against SQLite and returns a signed Bearer token.
     */
    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        try {
            String email = body.get("email");
            String password = body.get("password");

            User user = userService.loginUser(email, password);
            String token = tokenService.generateToken(user.getId());

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("token", token);
            response.put("user", user);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Login failed. Please try again.");
        }
    }

    /**
     * POST /api/auth/logout - Invalidates the active Bearer session token.
     */
    @PostMapping("/auth/logout")
    public ResponseEntity<?> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        tokenService.revokeToken(authHeader);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Logged out successfully.");
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/users/me - Returns details for the currently authenticated user.
     */
    @GetMapping("/users/me")
    public ResponseEntity<?> getCurrentUser(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            User user = userService.getUserById(userId);
            if (user == null) {
                return errorResponse(HttpStatus.NOT_FOUND, "User account not found.");
            }
            return ResponseEntity.ok(user);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not load user details.");
        }
    }

    private ResponseEntity<Map<String, String>> errorResponse(HttpStatus status, String message) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("error", message);
        return ResponseEntity.status(status).body(body);
    }
}

