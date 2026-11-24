package com.healthmate.controller;

import com.healthmate.model.UserSettings;
import com.healthmate.service.TokenService;
import com.healthmate.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * REST Controller for persisting user preferences (theme mode and reminder schedules) in SQLite.
 */
@RestController
@RequestMapping("/api/settings")
@CrossOrigin(origins = "*")
public class SettingsController {

    private final UserService userService;
    private final TokenService tokenService;

    public SettingsController(UserService userService, TokenService tokenService) {
        this.userService = userService;
        this.tokenService = tokenService;
    }

    /**
     * GET /api/settings - Retrieves theme and reminder preferences for the authenticated user.
     */
    @GetMapping
    public ResponseEntity<?> getSettings(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            UserSettings settings = userService.getUserSettings(userId);
            return ResponseEntity.ok(settings);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not load user settings.");
        }
    }

    /**
     * PUT /api/settings/theme - Saves the authenticated user's preferred theme mode.
     */
    @PutMapping("/theme")
    public ResponseEntity<?> updateTheme(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            String savedMode = userService.updateThemeMode(userId, body.get("themeMode"));

            Map<String, String> response = new LinkedHashMap<>();
            response.put("themeMode", savedMode);
            return ResponseEntity.ok(response);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (IllegalArgumentException e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save theme setting.");
        }
    }

    /**
     * PUT /api/settings/reminders - Saves the authenticated user's reminder schedule settings.
     */
    @PutMapping("/reminders")
    public ResponseEntity<?> updateReminders(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody UserSettings settingsBody
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            UserSettings updated = userService.updateReminderSettings(userId, settingsBody);
            return ResponseEntity.ok(updated);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (IllegalArgumentException e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save reminder settings.");
        }
    }

    private ResponseEntity<Map<String, String>> errorResponse(HttpStatus status, String message) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("error", message);
        return ResponseEntity.status(status).body(body);
    }
}

