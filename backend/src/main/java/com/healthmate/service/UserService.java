package com.healthmate.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthmate.database.DatabaseConnection;
import com.healthmate.model.User;
import com.healthmate.model.UserSettings;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Handles user registration, login password verification, user profiles, and user settings
 * using JDBC PreparedStatements and transactions against SQLite.
 */
@Service
public class UserService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern TIME_PATTERN = Pattern.compile("^([01]\\d|2[0-3]):([0-5]\\d)$");

    private final DatabaseConnection databaseConnection;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public UserService(DatabaseConnection databaseConnection) {
        this.databaseConnection = databaseConnection;
    }

    /**
     * Generates a random 16-byte salt encoded as a 32-character lowercase hex string.
     */
    private String generateSalt() {
        byte[] randomBytes = new byte[16];
        new SecureRandom().nextBytes(randomBytes);
        StringBuilder hex = new StringBuilder();
        for (byte b : randomBytes) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }

    /**
     * Hashes "<salt>:<password>" using SHA-256 to match existing HealthMate accounts securely.
     */
    private String hashPassword(String password, String salt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String combined = salt + ":" + password;
            byte[] hashBytes = digest.digest(combined.getBytes(StandardCharsets.UTF_8));

            StringBuilder hex = new StringBuilder();
            for (byte b : hashBytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new RuntimeException("Could not hash password.", e);
        }
    }

    private boolean isValidEmail(String email) {
        if (email == null) {
            return false;
        }
        return EMAIL_PATTERN.matcher(email.trim()).matches();
    }

    /**
     * Registers a new user and initializes default goals, profile, reminders, and theme
     * inside a single atomic JDBC transaction.
     */
    public User registerUser(String name, String email, String password) {
        String cleanName = name == null ? "" : name.trim();
        String cleanEmail = email == null ? "" : email.trim().toLowerCase();

        if (cleanName.length() < 2) {
            throw new IllegalArgumentException("Display name must be at least 2 characters.");
        }
        if (cleanName.length() > 50) {
            throw new IllegalArgumentException("Display name cannot exceed 50 characters.");
        }
        if (!isValidEmail(cleanEmail)) {
            throw new IllegalArgumentException("Please enter a valid email address.");
        }
        if (password == null || password.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters long.");
        }

        String salt = generateSalt();
        String passwordHash = hashPassword(password, salt);
        String createdAt = Instant.now().toString();

        try (Connection conn = databaseConnection.getConnection()) {
            conn.setAutoCommit(false);

            try {
                try (PreparedStatement checkStmt = conn.prepareStatement("SELECT id FROM users WHERE email = ?;")) {
                    checkStmt.setString(1, cleanEmail);
                    try (ResultSet rs = checkStmt.executeQuery()) {
                        if (rs.next()) {
                            throw new IllegalArgumentException("An account with this email address already exists.");
                        }
                    }
                }

                int userId;
                String insertUserSql = "INSERT INTO users (email, password_hash, salt, display_name, created_at) VALUES (?, ?, ?, ?, ?);";
                try (PreparedStatement userStmt = conn.prepareStatement(insertUserSql, Statement.RETURN_GENERATED_KEYS)) {
                    userStmt.setString(1, cleanEmail);
                    userStmt.setString(2, passwordHash);
                    userStmt.setString(3, salt);
                    userStmt.setString(4, cleanName);
                    userStmt.setString(5, createdAt);
                    userStmt.executeUpdate();

                    try (ResultSet keys = userStmt.getGeneratedKeys()) {
                        if (keys.next()) {
                            userId = keys.getInt(1);
                        } else {
                            throw new SQLException("Could not retrieve generated user ID.");
                        }
                    }
                }

                try (PreparedStatement goalsStmt = conn.prepareStatement(
                        "INSERT OR IGNORE INTO daily_goals (user_id, steps, calories, water) VALUES (?, 8000, 2000, 2000);")) {
                    goalsStmt.setInt(1, userId);
                    goalsStmt.executeUpdate();
                }

                try (PreparedStatement profileStmt = conn.prepareStatement(
                        "INSERT OR IGNORE INTO user_profile (user_id, name, email, photo_uri) VALUES (?, ?, ?, NULL);")) {
                    profileStmt.setInt(1, userId);
                    profileStmt.setString(2, cleanName);
                    profileStmt.setString(3, cleanEmail);
                    profileStmt.executeUpdate();
                }

                try (PreparedStatement reminderStmt = conn.prepareStatement(
                        "INSERT OR IGNORE INTO reminder_settings " +
                        "(user_id, water_enabled, water_time1, water_time2, water_time3, daily_enabled, daily_time, scheduled_ids) " +
                        "VALUES (?, 0, '09:00', '13:00', '17:00', 0, '20:30', '[]');")) {
                    reminderStmt.setInt(1, userId);
                    reminderStmt.executeUpdate();
                }

                try (PreparedStatement settingsStmt = conn.prepareStatement(
                        "INSERT OR IGNORE INTO app_settings (user_id, theme_mode) VALUES (?, 'system');")) {
                    settingsStmt.setInt(1, userId);
                    settingsStmt.executeUpdate();
                }

                conn.commit();
                return new User(userId, cleanName, cleanEmail, null, createdAt);
            } catch (Exception e) {
                conn.rollback();
                throw e;
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (SQLException e) {
            if (e.getMessage() != null && e.getMessage().toUpperCase().contains("UNIQUE")) {
                throw new IllegalArgumentException("An account with this email address already exists.");
            }
            throw new RuntimeException("Could not register user account: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("Could not register user account.", e);
        }
    }

    /**
     * Verifies a user's email and password and returns their account details.
     */
    public User loginUser(String email, String password) {
        String cleanEmail = email == null ? "" : email.trim().toLowerCase();

        if (!isValidEmail(cleanEmail)) {
            throw new IllegalArgumentException("Please enter a valid email address.");
        }
        if (password == null || password.isEmpty()) {
            throw new IllegalArgumentException("Please enter your password.");
        }

        String sql = "SELECT id, email, password_hash, salt, display_name, created_at FROM users WHERE email = ?;";
        try (Connection conn = databaseConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, cleanEmail);
            try (ResultSet rs = stmt.executeQuery()) {
                if (!rs.next()) {
                    throw new SecurityException("Invalid email or password.");
                }

                int userId = rs.getInt("id");
                String accountEmail = rs.getString("email");
                String storedHash = rs.getString("password_hash");
                String salt = rs.getString("salt");
                String displayName = rs.getString("display_name");
                String createdAt = rs.getString("created_at");

                String computedHash = hashPassword(password, salt).toLowerCase();
                boolean matches = MessageDigest.isEqual(
                        computedHash.getBytes(StandardCharsets.UTF_8),
                        storedHash.toLowerCase().getBytes(StandardCharsets.UTF_8)
                );

                if (!matches) {
                    throw new SecurityException("Invalid email or password.");
                }

                return loadMergedUserProfile(conn, userId, displayName, accountEmail, createdAt);
            }
        } catch (IllegalArgumentException | SecurityException e) {
            throw e;
        } catch (SQLException e) {
            throw new RuntimeException("Database error during login: " + e.getMessage(), e);
        }
    }

    /**
     * Retrieves a user's details by their authenticated user ID.
     */
    public User getUserById(int userId) {
        String sql = "SELECT id, email, display_name, created_at FROM users WHERE id = ?;";
        try (Connection conn = databaseConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setInt(1, userId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }

                String accountEmail = rs.getString("email");
                String displayName = rs.getString("display_name");
                String createdAt = rs.getString("created_at");
                return loadMergedUserProfile(conn, userId, displayName, accountEmail, createdAt);
            }
        } catch (SQLException e) {
            throw new RuntimeException("Could not load user details: " + e.getMessage(), e);
        }
    }

    private User loadMergedUserProfile(
            Connection conn,
            int userId,
            String fallbackName,
            String fallbackEmail,
            String createdAt
    ) throws SQLException {
        String profileSql = "SELECT name, email, photo_uri FROM user_profile WHERE user_id = ?;";
        try (PreparedStatement profileStmt = conn.prepareStatement(profileSql)) {
            profileStmt.setInt(1, userId);
            try (ResultSet prs = profileStmt.executeQuery()) {
                if (prs.next()) {
                    String profileName = prs.getString("name");
                    String profileEmail = prs.getString("email");
                    String photoUri = prs.getString("photo_uri");

                    String finalName = (profileName != null && !profileName.trim().isEmpty())
                            ? profileName
                            : fallbackName;
                    String finalEmail = (profileEmail != null && !profileEmail.trim().isEmpty())
                            ? profileEmail
                            : fallbackEmail;

                    return new User(userId, finalName, finalEmail, photoUri, createdAt);
                }
            }
        }
        return new User(userId, fallbackName, fallbackEmail, null, createdAt);
    }

    /**
     * Updates the user's profile (display name, email, and photo reference) and synchronizes
     * users.display_name inside a JDBC transaction so the Dashboard shows the updated name.
     */
    public User updateUserProfile(int userId, String name, String email, String photoUri) {
        String cleanName = name == null ? "" : name.trim();
        if (cleanName.isEmpty()) {
            throw new IllegalArgumentException("Display name is required.");
        }
        if (cleanName.length() > 50) {
            throw new IllegalArgumentException("Display name must be 50 characters or less.");
        }

        String cleanEmail = (email != null && !email.trim().isEmpty()) ? email.trim() : null;
        if (cleanEmail != null && !isValidEmail(cleanEmail)) {
            throw new IllegalArgumentException("Please enter a valid email address.");
        }

        String cleanPhotoUri = (photoUri != null && !photoUri.trim().isEmpty()) ? photoUri.trim() : null;

        try (Connection conn = databaseConnection.getConnection()) {
            conn.setAutoCommit(false);

            try {
                String upsertProfileSql = """
                    INSERT INTO user_profile (user_id, name, email, photo_uri)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        name = excluded.name,
                        email = excluded.email,
                        photo_uri = excluded.photo_uri;
                    """;
                try (PreparedStatement stmt = conn.prepareStatement(upsertProfileSql)) {
                    stmt.setInt(1, userId);
                    stmt.setString(2, cleanName);
                    if (cleanEmail != null) {
                        stmt.setString(3, cleanEmail);
                    } else {
                        stmt.setNull(3, Types.VARCHAR);
                    }
                    if (cleanPhotoUri != null) {
                        stmt.setString(4, cleanPhotoUri);
                    } else {
                        stmt.setNull(4, Types.VARCHAR);
                    }
                    stmt.executeUpdate();
                }

                try (PreparedStatement nameStmt = conn.prepareStatement(
                        "UPDATE users SET display_name = ? WHERE id = ?;")) {
                    nameStmt.setString(1, cleanName);
                    nameStmt.setInt(2, userId);
                    nameStmt.executeUpdate();
                }

                if (cleanEmail != null) {
                    String normalizedEmail = cleanEmail.toLowerCase();
                    boolean emailTakenByOther = false;
                    try (PreparedStatement checkEmail = conn.prepareStatement(
                            "SELECT id FROM users WHERE email = ? AND id != ?;")) {
                        checkEmail.setString(1, normalizedEmail);
                        checkEmail.setInt(2, userId);
                        try (ResultSet rs = checkEmail.executeQuery()) {
                            emailTakenByOther = rs.next();
                        }
                    }

                    if (!emailTakenByOther) {
                        try (PreparedStatement emailStmt = conn.prepareStatement(
                                "UPDATE users SET email = ? WHERE id = ?;")) {
                            emailStmt.setString(1, normalizedEmail);
                            emailStmt.setInt(2, userId);
                            emailStmt.executeUpdate();
                        }
                    }
                }

                conn.commit();
            } catch (Exception e) {
                conn.rollback();
                throw e;
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Could not update user profile: " + e.getMessage(), e);
        }

        return getUserById(userId);
    }

    /**
     * Clears the profile photo reference in SQLite for the authenticated user.
     */
    public User removeProfilePhoto(int userId) {
        String sql = "UPDATE user_profile SET photo_uri = NULL WHERE user_id = ?;";
        try (Connection conn = databaseConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            stmt.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Could not remove profile photo: " + e.getMessage(), e);
        }
        return getUserById(userId);
    }

    /**
     * Retrieves saved theme mode and notification reminder settings for a user.
     */
    public UserSettings getUserSettings(int userId) {
        UserSettings settings = new UserSettings();

        try (Connection conn = databaseConnection.getConnection()) {
            try (PreparedStatement themeStmt = conn.prepareStatement(
                    "SELECT theme_mode FROM app_settings WHERE user_id = ?;")) {
                themeStmt.setInt(1, userId);
                try (ResultSet rs = themeStmt.executeQuery()) {
                    if (rs.next()) {
                        String mode = rs.getString("theme_mode");
                        if ("light".equals(mode) || "dark".equals(mode) || "system".equals(mode)) {
                            settings.setThemeMode(mode);
                        }
                    }
                }
            }

            try (PreparedStatement remStmt = conn.prepareStatement(
                    "SELECT water_enabled, water_time1, water_time2, water_time3, daily_enabled, daily_time, scheduled_ids " +
                    "FROM reminder_settings WHERE user_id = ?;")) {
                remStmt.setInt(1, userId);
                try (ResultSet rs = remStmt.executeQuery()) {
                    if (rs.next()) {
                        settings.setWaterEnabled(rs.getInt("water_enabled") != 0);
                        settings.setWaterTime1(defaultIfBlank(rs.getString("water_time1"), "09:00"));
                        settings.setWaterTime2(defaultIfBlank(rs.getString("water_time2"), "13:00"));
                        settings.setWaterTime3(defaultIfBlank(rs.getString("water_time3"), "17:00"));
                        settings.setDailyEnabled(rs.getInt("daily_enabled") != 0);
                        settings.setDailyTime(defaultIfBlank(rs.getString("daily_time"), "20:30"));

                        String rawIds = rs.getString("scheduled_ids");
                        if (rawIds != null && !rawIds.trim().isEmpty()) {
                            try {
                                List<String> parsed = objectMapper.readValue(rawIds, new TypeReference<List<String>>() {});
                                settings.setScheduledIds(parsed);
                            } catch (Exception ignored) {
                                settings.setScheduledIds(new ArrayList<>());
                            }
                        }
                    }
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Could not load user settings: " + e.getMessage(), e);
        }

        return settings;
    }

    /**
     * Saves the user's preferred theme mode ('system', 'light', or 'dark') to SQLite.
     */
    public String updateThemeMode(int userId, String themeMode) {
        String cleanMode = themeMode == null ? "" : themeMode.trim().toLowerCase();
        if (!"system".equals(cleanMode) && !"light".equals(cleanMode) && !"dark".equals(cleanMode)) {
            throw new IllegalArgumentException("Theme mode must be 'system', 'light', or 'dark'.");
        }

        String sql = """
            INSERT INTO app_settings (user_id, theme_mode)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET theme_mode = excluded.theme_mode;
            """;
        try (Connection conn = databaseConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            stmt.setString(2, cleanMode);
            stmt.executeUpdate();
            return cleanMode;
        } catch (SQLException e) {
            throw new RuntimeException("Could not save theme setting: " + e.getMessage(), e);
        }
    }

    /**
     * Saves the user's water and daily reminder schedule settings to SQLite.
     */
    public UserSettings updateReminderSettings(int userId, UserSettings input) {
        String wt1 = validateTimeOrDefault(input.getWaterTime1(), "09:00");
        String wt2 = validateTimeOrDefault(input.getWaterTime2(), "13:00");
        String wt3 = validateTimeOrDefault(input.getWaterTime3(), "17:00");
        String dt = validateTimeOrDefault(input.getDailyTime(), "20:30");

        String scheduledIdsJson = "[]";
        try {
            List<String> ids = input.getScheduledIds() != null ? input.getScheduledIds() : new ArrayList<>();
            scheduledIdsJson = objectMapper.writeValueAsString(ids);
        } catch (Exception ignored) {
        }

        String sql = """
            INSERT INTO reminder_settings
                (user_id, water_enabled, water_time1, water_time2, water_time3, daily_enabled, daily_time, scheduled_ids)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                water_enabled = excluded.water_enabled,
                water_time1 = excluded.water_time1,
                water_time2 = excluded.water_time2,
                water_time3 = excluded.water_time3,
                daily_enabled = excluded.daily_enabled,
                daily_time = excluded.daily_time,
                scheduled_ids = excluded.scheduled_ids;
            """;

        try (Connection conn = databaseConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            stmt.setInt(2, input.isWaterEnabled() ? 1 : 0);
            stmt.setString(3, wt1);
            stmt.setString(4, wt2);
            stmt.setString(5, wt3);
            stmt.setInt(6, input.isDailyEnabled() ? 1 : 0);
            stmt.setString(7, dt);
            stmt.setString(8, scheduledIdsJson);
            stmt.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Could not save reminder settings: " + e.getMessage(), e);
        }

        return getUserSettings(userId);
    }

    private String validateTimeOrDefault(String value, String fallback) {
        if (value == null || value.trim().isEmpty()) {
            return fallback;
        }
        String trimmed = value.trim();
        if (!TIME_PATTERN.matcher(trimmed).matches()) {
            throw new IllegalArgumentException("Reminder time must use HH:mm 24-hour format.");
        }
        return trimmed;
    }

    private String defaultIfBlank(String value, String fallback) {
        return (value == null || value.trim().isEmpty()) ? fallback : value.trim();
    }
}

