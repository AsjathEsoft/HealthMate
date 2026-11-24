package com.healthmate.service;

import com.healthmate.database.DatabaseConnection;
import com.healthmate.model.DailyGoal;
import com.healthmate.model.HealthRecord;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Handles CRUD operations for daily health records and daily activity goals in SQLite.
 */
@Service
public class HealthService {

    private static final int DEFAULT_STEPS_GOAL = 8000;
    private static final int DEFAULT_CALORIES_GOAL = 2000;
    private static final int DEFAULT_WATER_GOAL = 2000;

    private final DatabaseConnection databaseConnection;

    public HealthService(DatabaseConnection databaseConnection) {
        this.databaseConnection = databaseConnection;
    }

    /**
     * Validates that a date string is a real calendar date in YYYY-MM-DD format.
     */
    private String validateCalendarDate(String dateText) {
        if (dateText == null || dateText.trim().isEmpty()) {
            throw new IllegalArgumentException("Please choose a valid calendar date (YYYY-MM-DD).");
        }
        String cleanDate = dateText.trim();
        if (!cleanDate.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            throw new IllegalArgumentException("Please choose a valid calendar date (YYYY-MM-DD).");
        }
        try {
            LocalDate.parse(cleanDate);
            return cleanDate;
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Please choose a valid calendar date (YYYY-MM-DD).");
        }
    }

    private void validateRecordMetrics(Integer steps, Integer calories, Integer water) {
        if (steps == null || steps < 0) {
            throw new IllegalArgumentException("Steps walked must be a whole number (0 or greater).");
        }
        if (calories == null || calories < 0) {
            throw new IllegalArgumentException("Calories burned must be a whole number (0 or greater).");
        }
        if (water == null || water < 0) {
            throw new IllegalArgumentException("Water intake must be a whole number (0 or greater).");
        }
    }

    /**
     * Returns all health records for the authenticated user ordered from newest date to oldest,
     * with an optional date filter.
     */
    public List<HealthRecord> getHealthRecords(int userId, String dateFilter) {
        List<HealthRecord> records = new ArrayList<>();
        boolean hasFilter = dateFilter != null && !dateFilter.trim().isEmpty();

        String sql = hasFilter
                ? "SELECT id, user_id, date, steps, calories, water FROM health_records WHERE user_id = ? AND date = ? ORDER BY date DESC;"
                : "SELECT id, user_id, date, steps, calories, water FROM health_records WHERE user_id = ? ORDER BY date DESC;";

        try (Connection conn = databaseConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setInt(1, userId);
            if (hasFilter) {
                stmt.setString(2, validateCalendarDate(dateFilter));
            }

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    HealthRecord record = new HealthRecord(
                            rs.getInt("id"),
                            rs.getInt("user_id"),
                            rs.getString("date"),
                            rs.getInt("steps"),
                            rs.getInt("calories"),
                            rs.getInt("water")
                    );
                    records.add(record);
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (SQLException e) {
            throw new RuntimeException("Could not fetch health records: " + e.getMessage(), e);
        }

        return records;
    }

    /**
     * Retrieves daily activity summary (record + goals + completion percentages) for a given date.
     */
    public Map<String, Object> getDailyActivity(int userId, String dateText) {
        String targetDate = (dateText == null || dateText.trim().isEmpty())
                ? LocalDate.now().toString()
                : validateCalendarDate(dateText);

        List<HealthRecord> allRecords = getHealthRecords(userId, null);
        DailyGoal goals = getDailyGoals(userId);

        HealthRecord activeRecord = null;
        for (HealthRecord item : allRecords) {
            if (targetDate.equals(item.getDate())) {
                activeRecord = item;
                break;
            }
        }

        int steps = activeRecord != null ? activeRecord.getSteps() : 0;
        int calories = activeRecord != null ? activeRecord.getCalories() : 0;
        int water = activeRecord != null ? activeRecord.getWater() : 0;

        int stepsPercent = goals.getSteps() > 0 ? Math.round((steps * 100.0f) / goals.getSteps()) : 0;
        int caloriesPercent = goals.getCalories() > 0 ? Math.round((calories * 100.0f) / goals.getCalories()) : 0;
        int waterPercent = goals.getWater() > 0 ? Math.round((water * 100.0f) / goals.getWater()) : 0;

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("date", targetDate);
        summary.put("hasRecord", activeRecord != null);
        summary.put("record", activeRecord);
        summary.put("goals", goals);
        summary.put("stepsPercent", stepsPercent);
        summary.put("caloriesPercent", caloriesPercent);
        summary.put("waterPercent", waterPercent);
        summary.put("recordedDaysCount", allRecords.size());
        return summary;
    }

    /**
     * Adds a new daily health record for the authenticated user.
     * When upsertOnConflict is true (used during offline-to-server synchronization),
     * an existing record on the same date is updated cleanly instead of creating duplicates.
     */
    public HealthRecord addHealthRecord(
            int userId,
            String date,
            Integer steps,
            Integer calories,
            Integer water,
            boolean upsertOnConflict
    ) {
        String cleanDate = validateCalendarDate(date);
        validateRecordMetrics(steps, calories, water);

        try (Connection conn = databaseConnection.getConnection()) {
            Integer existingId = null;
            try (PreparedStatement checkStmt = conn.prepareStatement(
                    "SELECT id FROM health_records WHERE user_id = ? AND date = ?;")) {
                checkStmt.setInt(1, userId);
                checkStmt.setString(2, cleanDate);
                try (ResultSet rs = checkStmt.executeQuery()) {
                    if (rs.next()) {
                        existingId = rs.getInt("id");
                    }
                }
            }

            if (existingId != null) {
                if (upsertOnConflict) {
                    return updateHealthRecord(userId, existingId, cleanDate, steps, calories, water);
                }
                throw new IllegalArgumentException(
                        "A health record for " + cleanDate + " already exists. Only one record per date is allowed."
                );
            }

            String insertSql = "INSERT INTO health_records (user_id, date, steps, calories, water) VALUES (?, ?, ?, ?, ?);";
            try (PreparedStatement stmt = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
                stmt.setInt(1, userId);
                stmt.setString(2, cleanDate);
                stmt.setInt(3, steps);
                stmt.setInt(4, calories);
                stmt.setInt(5, water);
                stmt.executeUpdate();

                try (ResultSet keys = stmt.getGeneratedKeys()) {
                    if (keys.next()) {
                        int newId = keys.getInt(1);
                        return new HealthRecord(newId, userId, cleanDate, steps, calories, water);
                    }
                }
            }
            throw new SQLException("Failed to retrieve generated record ID.");
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (SQLException e) {
            if (e.getMessage() != null && e.getMessage().toUpperCase().contains("UNIQUE")) {
                throw new IllegalArgumentException(
                        "A health record for " + cleanDate + " already exists. Only one record per date is allowed."
                );
            }
            throw new RuntimeException("Could not save health record: " + e.getMessage(), e);
        }
    }

    /**
     * Updates an existing health record owned by the authenticated user.
     */
    public HealthRecord updateHealthRecord(
            int userId,
            int recordId,
            String date,
            Integer steps,
            Integer calories,
            Integer water
    ) {
        String cleanDate = validateCalendarDate(date);
        validateRecordMetrics(steps, calories, water);

        try (Connection conn = databaseConnection.getConnection()) {
            try (PreparedStatement checkOwner = conn.prepareStatement(
                    "SELECT id FROM health_records WHERE id = ? AND user_id = ?;")) {
                checkOwner.setInt(1, recordId);
                checkOwner.setInt(2, userId);
                try (ResultSet rs = checkOwner.executeQuery()) {
                    if (!rs.next()) {
                        throw new IllegalArgumentException("Health record was not found.");
                    }
                }
            }

            try (PreparedStatement checkDup = conn.prepareStatement(
                    "SELECT id FROM health_records WHERE user_id = ? AND date = ? AND id != ?;")) {
                checkDup.setInt(1, userId);
                checkDup.setString(2, cleanDate);
                checkDup.setInt(3, recordId);
                try (ResultSet rs = checkDup.executeQuery()) {
                    if (rs.next()) {
                        throw new IllegalArgumentException("Another record already exists for " + cleanDate + ".");
                    }
                }
            }

            String updateSql = "UPDATE health_records SET date = ?, steps = ?, calories = ?, water = ? WHERE id = ? AND user_id = ?;";
            try (PreparedStatement stmt = conn.prepareStatement(updateSql)) {
                stmt.setString(1, cleanDate);
                stmt.setInt(2, steps);
                stmt.setInt(3, calories);
                stmt.setInt(4, water);
                stmt.setInt(5, recordId);
                stmt.setInt(6, userId);
                stmt.executeUpdate();
            }

            return new HealthRecord(recordId, userId, cleanDate, steps, calories, water);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (SQLException e) {
            throw new RuntimeException("Could not update health record: " + e.getMessage(), e);
        }
    }

    /**
     * Deletes a health record by ID if and only if it belongs to the authenticated user.
     */
    public boolean deleteHealthRecord(int userId, int recordId) {
        String sql = "DELETE FROM health_records WHERE id = ? AND user_id = ?;";
        try (Connection conn = databaseConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, recordId);
            stmt.setInt(2, userId);
            int affected = stmt.executeUpdate();
            return affected > 0;
        } catch (SQLException e) {
            throw new RuntimeException("Could not delete health record: " + e.getMessage(), e);
        }
    }

    /**
     * Deletes a health record by calendar date for the authenticated user (used by offline sync).
     */
    public boolean deleteHealthRecordByDate(int userId, String date) {
        String cleanDate = validateCalendarDate(date);
        String sql = "DELETE FROM health_records WHERE user_id = ? AND date = ?;";
        try (Connection conn = databaseConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            stmt.setString(2, cleanDate);
            int affected = stmt.executeUpdate();
            return affected > 0;
        } catch (SQLException e) {
            throw new RuntimeException("Could not delete health record: " + e.getMessage(), e);
        }
    }

    /**
     * Retrieves the authenticated user's daily step, calorie, and water targets.
     */
    public DailyGoal getDailyGoals(int userId) {
        String sql = "SELECT steps, calories, water FROM daily_goals WHERE user_id = ?;";
        try (Connection conn = databaseConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return new DailyGoal(
                            rs.getInt("steps"),
                            rs.getInt("calories"),
                            rs.getInt("water")
                    );
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Could not load daily goals: " + e.getMessage(), e);
        }

        return new DailyGoal(DEFAULT_STEPS_GOAL, DEFAULT_CALORIES_GOAL, DEFAULT_WATER_GOAL);
    }

    /**
     * Updates the authenticated user's daily step, calorie, and water targets.
     */
    public DailyGoal updateDailyGoals(int userId, Integer steps, Integer calories, Integer water) {
        if (steps == null || steps <= 0) {
            throw new IllegalArgumentException("Steps goal must be a whole number greater than 0.");
        }
        if (calories == null || calories <= 0) {
            throw new IllegalArgumentException("Calories goal must be a whole number greater than 0.");
        }
        if (water == null || water <= 0) {
            throw new IllegalArgumentException("Water intake goal must be a whole number greater than 0.");
        }

        String sql = """
            INSERT INTO daily_goals (user_id, steps, calories, water)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                steps = excluded.steps,
                calories = excluded.calories,
                water = excluded.water;
            """;
        try (Connection conn = databaseConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            stmt.setInt(2, steps);
            stmt.setInt(3, calories);
            stmt.setInt(4, water);
            stmt.executeUpdate();
            return new DailyGoal(steps, calories, water);
        } catch (SQLException e) {
            throw new RuntimeException("Could not save daily goals: " + e.getMessage(), e);
        }
    }
}

