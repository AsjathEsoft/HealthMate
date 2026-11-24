package com.healthmate.controller;

import com.healthmate.model.DailyGoal;
import com.healthmate.model.HealthRecord;
import com.healthmate.service.HealthService;
import com.healthmate.service.TokenService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for daily health records CRUD, daily activity summary, and daily goals.
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class HealthController {

    private final HealthService healthService;
    private final TokenService tokenService;

    public HealthController(HealthService healthService, TokenService tokenService) {
        this.healthService = healthService;
        this.tokenService = tokenService;
    }

    /**
     * GET /api/health-records - Lists all health records for the authenticated user.
     */
    @GetMapping("/health-records")
    public ResponseEntity<?> getHealthRecords(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "date", required = false) String date
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            List<HealthRecord> records = healthService.getHealthRecords(userId, date);
            return ResponseEntity.ok(records);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (IllegalArgumentException e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load health records.");
        }
    }

    /**
     * GET /api/health-records/daily - Returns daily activity summary and goal progress for a date.
     */
    @GetMapping("/health-records/daily")
    public ResponseEntity<?> getDailyActivity(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "date", required = false) String date
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            Map<String, Object> summary = healthService.getDailyActivity(userId, date);
            return ResponseEntity.ok(summary);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (IllegalArgumentException e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not load daily activity.");
        }
    }

    /**
     * POST /api/health-records - Adds a new health record for the authenticated user.
     */
    @PostMapping("/health-records")
    public ResponseEntity<?> addHealthRecord(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "upsert", defaultValue = "false") boolean upsert,
            @RequestBody Map<String, Object> body
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            String date = body.get("date") != null ? String.valueOf(body.get("date")) : null;
            Integer steps = parseIntegerField(body.get("steps"), "Steps walked");
            Integer calories = parseIntegerField(body.get("calories"), "Calories burned");
            Integer water = parseIntegerField(body.get("water"), "Water intake");

            HealthRecord created = healthService.addHealthRecord(
                    userId,
                    date,
                    steps,
                    calories,
                    water,
                    upsert
            );
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (IllegalArgumentException e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save health record.");
        }
    }

    /**
     * PUT /api/health-records/{id} - Updates an existing health record owned by the authenticated user.
     */
    @PutMapping("/health-records/{id}")
    public ResponseEntity<?> updateHealthRecord(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") int id,
            @RequestBody Map<String, Object> body
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            String date = body.get("date") != null ? String.valueOf(body.get("date")) : null;
            Integer steps = parseIntegerField(body.get("steps"), "Steps walked");
            Integer calories = parseIntegerField(body.get("calories"), "Calories burned");
            Integer water = parseIntegerField(body.get("water"), "Water intake");

            HealthRecord updated = healthService.updateHealthRecord(
                    userId,
                    id,
                    date,
                    steps,
                    calories,
                    water
            );
            return ResponseEntity.ok(updated);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (IllegalArgumentException e) {
            HttpStatus status = e.getMessage() != null && e.getMessage().contains("not found")
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.BAD_REQUEST;
            return errorResponse(status, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not update health record.");
        }
    }

    /**
     * DELETE /api/health-records/{id} - Deletes a health record owned by the authenticated user.
     */
    @DeleteMapping("/health-records/{id}")
    public ResponseEntity<?> deleteHealthRecord(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") int id
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            boolean deleted = healthService.deleteHealthRecord(userId, id);
            if (!deleted) {
                return errorResponse(HttpStatus.NOT_FOUND, "Health record was not found.");
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("deleted", true);
            response.put("id", id);
            return ResponseEntity.ok(response);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not delete health record.");
        }
    }

    /**
     * DELETE /api/health-records/by-date/{date} - Deletes a user's record by date (used during offline sync).
     */
    @DeleteMapping("/health-records/by-date/{date}")
    public ResponseEntity<?> deleteHealthRecordByDate(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("date") String date
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            boolean deleted = healthService.deleteHealthRecordByDate(userId, date);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("deleted", deleted);
            response.put("date", date);
            return ResponseEntity.ok(response);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (IllegalArgumentException e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not delete health record.");
        }
    }

    /**
     * GET /api/goals - Retrieves daily step, calorie, and water goals for the authenticated user.
     */
    @GetMapping("/goals")
    public ResponseEntity<?> getGoals(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            DailyGoal goals = healthService.getDailyGoals(userId);
            return ResponseEntity.ok(goals);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not load daily goals.");
        }
    }

    /**
     * PUT /api/goals - Updates daily step, calorie, and water goals for the authenticated user.
     */
    @PutMapping("/goals")
    public ResponseEntity<?> updateGoals(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body
    ) {
        try {
            int userId = tokenService.validateAndGetUserId(authHeader);
            Integer steps = parseIntegerField(body.get("steps"), "Steps goal");
            Integer calories = parseIntegerField(body.get("calories"), "Calories goal");
            Integer water = parseIntegerField(body.get("water"), "Water intake goal");

            DailyGoal updated = healthService.updateDailyGoals(userId, steps, calories, water);
            return ResponseEntity.ok(updated);
        } catch (SecurityException e) {
            return errorResponse(HttpStatus.UNAUTHORIZED, e.getMessage());
        } catch (IllegalArgumentException e) {
            return errorResponse(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save daily goals.");
        }
    }

    private Integer parseIntegerField(Object rawValue, String fieldName) {
        if (rawValue == null) {
            throw new IllegalArgumentException(fieldName + " is required.");
        }
        if (rawValue instanceof Integer intVal) {
            return intVal;
        }
        if (rawValue instanceof Number numVal) {
            double d = numVal.doubleValue();
            if (d != Math.floor(d) || Double.isInfinite(d)) {
                throw new IllegalArgumentException(fieldName + " must be a whole number.");
            }
            return numVal.intValue();
        }
        String text = String.valueOf(rawValue).trim();
        if (!text.matches("^-?\\d+$")) {
            throw new IllegalArgumentException(fieldName + " must be a whole number.");
        }
        try {
            return Integer.parseInt(text);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(fieldName + " value is out of range.");
        }
    }

    private ResponseEntity<Map<String, String>> errorResponse(HttpStatus status, String message) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("error", message);
        return ResponseEntity.status(status).body(body);
    }
}

