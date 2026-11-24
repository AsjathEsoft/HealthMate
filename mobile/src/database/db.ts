// Database connection, local SQLite cache, and offline sync queue for HealthMate
//
// HOW DATA STORAGE WORKS:
// 1. When the Java Spring Boot backend is reachable, React Native communicates with
//    Java over REST APIs (which read/write the main "health_records.db" on the server)
//    and mirrors the latest data into Android's local SQLite database.
// 2. If the Java backend is offline, changes are saved to Android's local SQLite
//    database and recorded in "offline_sync_queue" so they sync automatically
//    as soon as the Java backend reconnects.

import * as SQLite from 'expo-sqlite';
import { importDatabaseFromAssetAsync } from 'expo-sqlite';
import {
  ApiUser,
  apiAddHealthRecord,
  apiCheckServerHealth,
  apiDeleteHealthRecordByDate,
  apiRemoveProfilePhoto,
  apiUpdateDailyGoals,
  apiUpdateReminderSettings,
  apiUpdateThemeMode,
  apiUpdateUserProfile,
  isNetworkOfflineError,
} from '../services/api';

const DATABASE_NAME = 'health_records.db';

type OfflineActionType =
  | 'UPSERT_RECORD'
  | 'DELETE_RECORD'
  | 'UPDATE_GOALS'
  | 'UPDATE_PROFILE'
  | 'REMOVE_PHOTO'
  | 'UPDATE_THEME'
  | 'UPDATE_REMINDERS';

let databaseInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let activeSyncPromise: Promise<boolean> | null = null;

// SQL statement that creates all required tables (plus the offline sync queue)
const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

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

  CREATE TABLE IF NOT EXISTS daily_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    steps INTEGER NOT NULL,
    calories INTEGER NOT NULL,
    water INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    photo_uri TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

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

  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    theme_mode TEXT NOT NULL DEFAULT 'system',
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_health_records_user_date ON health_records (user_id, date);
  CREATE INDEX IF NOT EXISTS idx_daily_goals_user ON daily_goals (user_id);
  CREATE INDEX IF NOT EXISTS idx_user_profile_user ON user_profile (user_id);
  CREATE INDEX IF NOT EXISTS idx_reminder_settings_user ON reminder_settings (user_id);
  CREATE INDEX IF NOT EXISTS idx_app_settings_user ON app_settings (user_id);
  CREATE INDEX IF NOT EXISTS idx_offline_queue_user ON offline_sync_queue (user_id, id);

  PRAGMA user_version = 5;
`;

// Initialize the SQLite database on app startup
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  // 1. Copy the pre-bundled database from assets only if no database exists on the device yet
  try {
    await importDatabaseFromAssetAsync(DATABASE_NAME, {
      assetId: require('../../assets/health_records.db'),
      forceOverwrite: false,
    });
  } catch {
    // Ignore if database already exists on the device
  }

  // 2. Open the local SQLite database
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // 3. Enable WAL journal mode and foreign key rules
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // 4. Make sure all tables exist
  await db.execAsync(CREATE_TABLES_SQL);

  databaseInstance = db;

  return db;
}

// Get the active SQLite database connection
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (databaseInstance) {
    return databaseInstance;
  }

  if (!initPromise) {
    initPromise = initDatabase();
  }

  return initPromise;
}

// Safely mirror a Java backend user into Android's local SQLite cache without triggering ON DELETE CASCADE
export async function cacheServerUserLocally(
  user: ApiUser,
  passwordHash?: string,
  salt?: string
): Promise<void> {
  const db = await getDatabase();
  const cleanEmail = user.email.trim().toLowerCase();

  // Remove any stale local row that used the same email under a different local ID
  await db.runAsync('DELETE FROM users WHERE email = ? AND id != ?;', [cleanEmail, user.id]);

  const existing = await db.getFirstAsync<{
    password_hash: string;
    salt: string;
    created_at: string;
  }>('SELECT password_hash, salt, created_at FROM users WHERE id = ?;', [user.id]);

  const finalHash = passwordHash || existing?.password_hash || 'server_managed_account';
  const finalSalt = salt || existing?.salt || 'server_managed_salt';
  const finalCreatedAt = user.createdAt || existing?.created_at || new Date().toISOString();

  await db.runAsync(
    `INSERT INTO users (id, email, password_hash, salt, display_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       password_hash = excluded.password_hash,
       salt = excluded.salt,
       display_name = excluded.display_name;`,
    [user.id, cleanEmail, finalHash, finalSalt, user.name, finalCreatedAt]
  );

  await db.runAsync(
    `INSERT INTO user_profile (user_id, name, email, photo_uri)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       name = excluded.name,
       email = excluded.email,
       photo_uri = excluded.photo_uri;`,
    [user.id, user.name, cleanEmail, user.photoUri]
  );

  await db.runAsync(
    'INSERT OR IGNORE INTO daily_goals (user_id, steps, calories, water) VALUES (?, 8000, 2000, 2000);',
    [user.id]
  );

  await db.runAsync(
    `INSERT OR IGNORE INTO reminder_settings
       (user_id, water_enabled, water_time1, water_time2, water_time3, daily_enabled, daily_time, scheduled_ids)
     VALUES (?, 0, '09:00', '13:00', '17:00', 0, '20:30', '[]');`,
    [user.id]
  );

  await db.runAsync(
    "INSERT OR IGNORE INTO app_settings (user_id, theme_mode) VALUES (?, 'system');",
    [user.id]
  );
}

// Record a local change when the Java backend is offline so it can sync later
export async function enqueueOfflineAction(
  userId: number,
  actionType: OfflineActionType,
  payload: Record<string, unknown>
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO offline_sync_queue (user_id, action_type, payload_json, created_at)
     VALUES (?, ?, ?, ?);`,
    [userId, actionType, JSON.stringify(payload), new Date().toISOString()]
  );
}

// Replay queued offline changes to the Java backend in order (Last-Write-Wins)
// Returns true if all queued items for this user are synced (queue is empty), or false if still offline
export async function syncOfflineChangesWithBackend(userId: number): Promise<boolean> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    const db = await getDatabase();
    const pendingRows = await db.getAllAsync<{
      id: number;
      action_type: OfflineActionType;
      payload_json: string;
    }>(
      'SELECT id, action_type, payload_json FROM offline_sync_queue WHERE user_id = ? ORDER BY id ASC;',
      [userId]
    );

    if (pendingRows.length === 0) {
      return true;
    }

    for (const item of pendingRows) {
      let payload: any = {};
      try {
        payload = JSON.parse(item.payload_json);
      } catch {
        await db.runAsync('DELETE FROM offline_sync_queue WHERE id = ?;', [item.id]);
        continue;
      }

      try {
        if (item.action_type === 'UPSERT_RECORD') {
          if (payload.previousDate && payload.previousDate !== payload.date) {
            await apiDeleteHealthRecordByDate(payload.previousDate);
          }
          await apiAddHealthRecord(
            payload.date,
            payload.steps,
            payload.calories,
            payload.water,
            true
          );
        } else if (item.action_type === 'DELETE_RECORD') {
          await apiDeleteHealthRecordByDate(payload.date);
        } else if (item.action_type === 'UPDATE_GOALS') {
          await apiUpdateDailyGoals(payload.steps, payload.calories, payload.water);
        } else if (item.action_type === 'UPDATE_PROFILE') {
          await apiUpdateUserProfile(payload.name, payload.email, payload.photoUri);
        } else if (item.action_type === 'REMOVE_PHOTO') {
          await apiRemoveProfilePhoto();
        } else if (item.action_type === 'UPDATE_THEME') {
          await apiUpdateThemeMode(payload.themeMode);
        } else if (item.action_type === 'UPDATE_REMINDERS') {
          await apiUpdateReminderSettings(payload);
        }

        // Remove the item once the Java backend confirms it was saved
        await db.runAsync('DELETE FROM offline_sync_queue WHERE id = ?;', [item.id]);
      } catch (error) {
        if (isNetworkOfflineError(error)) {
          // Stop replaying and keep remaining items queued until server is reachable
          return false;
        }
        const status = (error as { status?: number })?.status;
        if (status === 401) {
          return false;
        }
        // Discard non-retryable validation errors so one bad entry cannot block newer updates
        await db.runAsync('DELETE FROM offline_sync_queue WHERE id = ?;', [item.id]);
      }
    }

    return true;
  })();

  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

// Import rows if a database file was manually pushed from Windows while offline ("npm run db:push")
export async function syncFromPushedDatabase(db?: SQLite.SQLiteDatabase): Promise<void> {
  const activeDb = db || (await getDatabase());

  // Never overwrite unsynced offline changes or active Java server state
  const queueCount = await activeDb.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM offline_sync_queue;'
  );
  if (queueCount && queueCount.count > 0) {
    return;
  }

  const serverOnline = await apiCheckServerHealth();
  if (serverOnline) {
    return;
  }

  const sharedPaths = [
    '/sdcard/Android/data/host.exp.exponent/health_records_export.db',
    '/sdcard/Download/health_records_export.db',
  ];

  for (const filePath of sharedPaths) {
    try {
      await activeDb.execAsync(`
        ATTACH DATABASE '${filePath}' AS pushed_db;

        INSERT INTO users (id, email, password_hash, salt, display_name, created_at)
        SELECT id, email, password_hash, salt, display_name, created_at FROM pushed_db.users
        WHERE true
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email,
          password_hash = excluded.password_hash,
          salt = excluded.salt,
          display_name = excluded.display_name,
          created_at = excluded.created_at;

        INSERT OR REPLACE INTO health_records (id, user_id, date, steps, calories, water)
        SELECT id, user_id, date, steps, calories, water FROM pushed_db.health_records;

        INSERT OR REPLACE INTO daily_goals (id, user_id, steps, calories, water)
        SELECT id, user_id, steps, calories, water FROM pushed_db.daily_goals;

        INSERT OR REPLACE INTO user_profile (id, user_id, name, email, photo_uri)
        SELECT id, user_id, name, email, photo_uri FROM pushed_db.user_profile;

        INSERT OR REPLACE INTO reminder_settings (id, user_id, water_enabled, water_time1, water_time2, water_time3, daily_enabled, daily_time, scheduled_ids)
        SELECT id, user_id, water_enabled, water_time1, water_time2, water_time3, daily_enabled, daily_time, scheduled_ids FROM pushed_db.reminder_settings;

        INSERT OR REPLACE INTO app_settings (id, user_id, theme_mode)
        SELECT id, user_id, theme_mode FROM pushed_db.app_settings;

        DETACH DATABASE pushed_db;
      `);
      break;
    } catch {
      try {
        await activeDb.execAsync('DETACH DATABASE pushed_db;');
      } catch { }
    }
  }
}