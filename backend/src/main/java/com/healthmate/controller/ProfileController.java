package com.healthmate.controller;

import com.healthmate.model.User;
import com.healthmate.service.TokenService;
import com.healthmate.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * REST Controller for retrieving and updating the authenticated user's profile and photo reference.
 */
@RestController
@RequestMapping("/api/users/me")
@CrossOrigin(origins = "*")
public class ProfileController {

    private final UserService userService;
    private final TokenService tokenService;

    public ProfileController(UserService userService, TokenService tokenService) {
        this.userService = userService;
        this.tokenService = tokenService;
    }

    /**
     * GET /api/users/me/profile - Retrieves the authenticated user's profile details.
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            User user = userService.getUserById(userId);
            if (user == null) {
                return errorResponse(HttpStatus.NOT_FOUND, "User profile not found.");
            }

            Map<String, Object> profile = new LinkedHashMap<>();
            profile.put("name", user.getName());
            profile.put("email", user.getEmail());
            profile.put("photoUri", user.getPhotoUri());
            return ResponseEntity.ok(profile);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not load user profile.");
        }
    }

    /**
     * PUT /api/users/me/profile - Updates display name, email address, and profile photo reference.
     */
    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);

            String name = body.get("name") != null ? String.valueOf(body.get("name")) : "";
            String email = body.get("email") != null ? String.valueOf(body.get("email")) : null;
            String photoUri = body.get("photoUri") != null ? String.valueOf(body.get("photoUri")) : null;

            User updated = userService.updateUserProfile(userId, name, email, photoUri);

            Map<String, Object> profile = new LinkedHashMap<>();
            profile.put("name", updated.getName());
            profile.put("email", updated.getEmail());
            profile.put("photoUri", updated.getPhotoUri());
            return ResponseEntity.ok(profile);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (IllegalArgumentException e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not update user profile.");
        }
    }

    /**
     * DELETE /api/users/me/profile/photo - Removes the authenticated user's profile photo reference.
     */
    @DeleteMapping("/profile/photo")
    public ResponseEntity<?> removeProfilePhoto(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            User updated = userService.removeProfilePhoto(userId);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("message", "Profile photo removed.");
            response.put("photoUri", updated.getPhotoUri());
            return ResponseEntity.ok(response);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not remove profile photo.");
        }
    }

    private ResponseEntity<Map<String, String>> errorResponse(HttpStatus status, String message) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("error", message);
        return ResponseEntity.status(status).body(body);
    }
}

