package com.healthmate.database;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Manages the SQLite JDBC connection to the existing health_records.db file.
 */
@Component
public class DatabaseConnection {

    private final String resolvedDbPath;
    private final String jdbcUrl;

    public DatabaseConnection(@Value("${healthmate.db.path:../health_records.db}") String configuredPath) {
        this.resolvedDbPath = resolveDatabaseFilePath(configuredPath);
        this.jdbcUrl = "jdbc:sqlite:" + this.resolvedDbPath;
    }

    /**
     * Resolves the path to health_records.db whether the server is started
     * from HealthMate/backend/ or from the HealthMate/ project root folder.
     */
    private String resolveDatabaseFilePath(String configuredPath) {
        String envPath = System.getenv("HEALTHMATE_DB_PATH");
        if (envPath != null && !envPath.trim().isEmpty()) {
            return new File(envPath.trim()).getAbsolutePath();
        }

        File candidate = new File(configuredPath);
        if (candidate.exists()) {
            return candidate.getAbsolutePath();
        }

        File rootCandidate = new File("health_records.db");
        if (rootCandidate.exists()) {
            return rootCandidate.getAbsolutePath();
        }

        return candidate.getAbsolutePath();
    }

    /**
     * Opens a new JDBC connection to SQLite with foreign keys and busy timeout enabled.
     */
    public Connection getConnection() throws SQLException {
        Connection connection = DriverManager.getConnection(jdbcUrl);
        try (Statement stmt = connection.createStatement()) {
            stmt.execute("PRAGMA foreign_keys = ON;");
            stmt.execute("PRAGMA busy_timeout = 5000;");
        }
        return connection;
    }

    /**
     * Runs on startup to verify connectivity and ensure all 6 existing tables exist
     * without deleting or altering any existing user data.
     */
    @PostConstruct
    public void initializeDatabase() {
        System.out.println("Connecting to HealthMate SQLite database at: " + resolvedDbPath);

        try (Connection connection = getConnection();
             Statement stmt = connection.createStatement()) {

            stmt.execute("PRAGMA journal_mode = WAL;");

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """);

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS health_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    steps INTEGER NOT NULL,
                    calories INTEGER NOT NULL,
                    water INTEGER NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    UNIQUE (user_id, date)
                );
                """);

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS daily_goals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL UNIQUE,
                    steps INTEGER NOT NULL,
                    calories INTEGER NOT NULL,
                    water INTEGER NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
                """);

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS user_profile (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    email TEXT,
                    photo_uri TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
                """);

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS reminder_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL UNIQUE,
                    water_enabled INTEGER NOT NULL DEFAULT 0,
                    water_time1 TEXT NOT NULL DEFAULT '09:00',
                    water_time2 TEXT NOT NULL DEFAULT '13:00',
                    water_time3 TEXT NOT NULL DEFAULT '17:00',
                    daily_enabled INTEGER NOT NULL DEFAULT 0,
                    daily_time TEXT NOT NULL DEFAULT '20:30',
                    scheduled_ids TEXT NOT NULL DEFAULT '[]',
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
                """);

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS app_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL UNIQUE,
                    theme_mode TEXT NOT NULL DEFAULT 'system',
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
                """);

            stmt.execute("CREATE INDEX IF NOT EXISTS idx_health_records_user_date ON health_records (user_id, date);");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_daily_goals_user ON daily_goals (user_id);");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_user_profile_user ON user_profile (user_id);");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_reminder_settings_user ON reminder_settings (user_id);");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_app_settings_user ON app_settings (user_id);");

            System.out.println("SQLite database verified and ready.");
        } catch (SQLException e) {
            throw new RuntimeException("Failed to initialize SQLite database: " + e.getMessage(), e);
        }
    }
}

