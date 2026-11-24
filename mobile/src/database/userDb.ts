// Functions for authentication, user profiles, reminders, and theme settings
// Communicates with the Java Spring Boot REST API first and falls back to local SQLite when offline

import * as Crypto from 'expo-crypto';
import {
  cacheServerUserLocally,
  enqueueOfflineAction,
  getDatabase,
  syncOfflineChangesWithBackend,
} from './db';
import {
  NetworkOfflineError,
  apiGetCurrentUser,
  apiGetUserProfile,
  apiGetUserSettings,
  apiLoginUser,
  apiRegisterUser,
  apiRemoveProfilePhoto,
  apiUpdateReminderSettings,
  apiUpdateThemeMode,
  apiUpdateUserProfile,
  isNetworkOfflineError,
} from '../services/api';
import { isValidEmail } from '../utils/validation';

export interface UserAccount {
  id: number;
  name: string;
  email: string;
  photoUri: string | null;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  email: string | null;
  photoUri: string | null;
}

export interface ReminderSettings {
  waterEnabled: boolean;
  waterTime1: string;
  waterTime2: string;
  waterTime3: string;
  dailyEnabled: boolean;
  dailyTime: string;
  scheduledIds: string[];
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  waterEnabled: false,
  waterTime1: '09:00',
  waterTime2: '13:00',
  waterTime3: '17:00',
  dailyEnabled: false,
  dailyTime: '20:30',
  scheduledIds: [],
};

// Generate a random 16-byte hex salt for local offline password verification
async function generateSalt(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Hash a password with its unique salt using SHA-256 (matches Java UserService hashing)
async function hashPassword(password: string, salt: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`
  );
}

// Save profile details into Android's local SQLite mirror
async function saveProfileLocally(
  userId: number,
  name: string,
  email: string | null,
  photoUri: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO user_profile (user_id, name, email, photo_uri)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       name = excluded.name,
       email = excluded.email,
       photo_uri = excluded.photo_uri;`,
    [userId, name, email, photoUri]
  );

  await db.runAsync('UPDATE users SET display_name = ? WHERE id = ?;', [name, userId]);

  if (email) {
    try {
      await db.runAsync('UPDATE users SET email = ? WHERE id = ?;', [
        email.toLowerCase(),
        userId,
      ]);
    } catch {
      // Ignore if email conflicts locally
    }
  }
}

// Save reminder settings into Android's local SQLite mirror
async function saveRemindersLocally(userId: number, settings: ReminderSettings): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO reminder_settings
       (user_id, water_enabled, water_time1, water_time2, water_time3, daily_enabled, daily_time, scheduled_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       water_enabled = excluded.water_enabled,
       water_time1 = excluded.water_time1,
       water_time2 = excluded.water_time2,
       water_time3 = excluded.water_time3,
       daily_enabled = excluded.daily_enabled,
       daily_time = excluded.daily_time,
       scheduled_ids = excluded.scheduled_ids;`,
    [
      userId,
      settings.waterEnabled ? 1 : 0,
      settings.waterTime1,
      settings.waterTime2,
      settings.waterTime3,
      settings.dailyEnabled ? 1 : 0,
      settings.dailyTime,
      JSON.stringify(settings.scheduledIds),
    ]
  );
}

// Register a new user account via the Java Spring Boot backend
export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<UserAccount> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanName.length < 2) {
    throw new Error('Display name must be at least 2 characters.');
  }
  if (!isValidEmail(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  try {
    const authResult = await apiRegisterUser(cleanName, cleanEmail, password);

    const localSalt = await generateSalt();
    const localHash = await hashPassword(password, localSalt);
    await cacheServerUserLocally(authResult.user, localHash, localSalt);

    return {
      id: authResult.user.id,
      name: authResult.user.name,
      email: authResult.user.email,
      photoUri: authResult.user.photoUri,
      createdAt: authResult.user.createdAt,
    };
  } catch (error) {
    if (isNetworkOfflineError(error)) {
      throw new Error(
        'Cannot register a new account while offline. Please start the HealthMate Java server and try again.'
      );
    }
    throw error instanceof Error ? error : new Error('Could not register user account.');
  }
}

// Verify email and password via the Java Spring Boot backend (with offline fallback for cached users)
export async function loginUser(email: string, password: string): Promise<UserAccount> {
  const cleanEmail = email.trim().toLowerCase();

  if (!isValidEmail(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  try {
    const authResult = await apiLoginUser(cleanEmail, password);

    const localSalt = await generateSalt();
    const localHash = await hashPassword(password, localSalt);
    await cacheServerUserLocally(authResult.user, localHash, localSalt);
    await syncOfflineChangesWithBackend(authResult.user.id);

    return {
      id: authResult.user.id,
      name: authResult.user.name,
      email: authResult.user.email,
      photoUri: authResult.user.photoUri,
      createdAt: authResult.user.createdAt,
    };
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Invalid email or password.');
    }

    // Offline fallback: verify credentials against Android's cached local SQLite database
    const db = await getDatabase();
    const userRow = await db.getFirstAsync<{
      id: number;
      email: string;
      password_hash: string;
      salt: string;
      display_name: string;
      created_at: string;
    }>(
      'SELECT id, email, password_hash, salt, display_name, created_at FROM users WHERE email = ?;',
      [cleanEmail]
    );

    if (!userRow) {
      throw new Error(
        'Java server is offline and this account is not cached on this device yet.'
      );
    }

    const enteredHash = await hashPassword(password, userRow.salt);
    if (enteredHash.toLowerCase() !== userRow.password_hash.toLowerCase()) {
      throw new Error('Invalid email or password.');
    }

    const profileRow = await db.getFirstAsync<{
      name: string;
      email: string | null;
      photo_uri: string | null;
    }>('SELECT name, email, photo_uri FROM user_profile WHERE user_id = ?;', [userRow.id]);

    return {
      id: userRow.id,
      name: profileRow?.name || userRow.display_name,
      email: profileRow?.email || userRow.email,
      photoUri: profileRow?.photo_uri || null,
      createdAt: userRow.created_at,
    };
  }
}

// Get a user account by ID (restores saved session via Java GET /api/users/me or local cache when offline)
export async function getUserById(userId: number): Promise<UserAccount | null> {
  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    const serverUser = await apiGetCurrentUser();
    if (serverUser.id !== userId) {
      return null;
    }

    await cacheServerUserLocally(serverUser);
    return {
      id: serverUser.id,
      name: serverUser.name,
      email: serverUser.email,
      photoUri: serverUser.photoUri,
      createdAt: serverUser.createdAt,
    };
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 401 || status === 404) {
      return null;
    }

    if (!isNetworkOfflineError(error)) {
      return null;
    }

    // Offline fallback: read user from Android's local SQLite cache
    const db = await getDatabase();
    const userRow = await db.getFirstAsync<{
      id: number;
      email: string;
      display_name: string;
      created_at: string;
    }>('SELECT id, email, display_name, created_at FROM users WHERE id = ?;', [userId]);

    if (!userRow) {
      return null;
    }

    const profileRow = await db.getFirstAsync<{
      name: string;
      email: string | null;
      photo_uri: string | null;
    }>('SELECT name, email, photo_uri FROM user_profile WHERE user_id = ?;', [userRow.id]);

    return {
      id: userRow.id,
      name: profileRow?.name || userRow.display_name,
      email: profileRow?.email || userRow.email,
      photoUri: profileRow?.photo_uri || null,
      createdAt: userRow.created_at,
    };
  }
}

// Get the user's profile from the Java backend (or local SQLite when offline)
export async function getUserProfile(userId: number): Promise<UserProfile | null> {
  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    const serverProfile = await apiGetUserProfile();
    await saveProfileLocally(
      userId,
      serverProfile.name,
      serverProfile.email,
      serverProfile.photoUri
    );
    return serverProfile;
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Could not load user profile.');
    }

    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      name: string;
      email: string | null;
      photo_uri: string | null;
    }>('SELECT name, email, photo_uri FROM user_profile WHERE user_id = ?;', [userId]);

    if (!row || !row.name) {
      return null;
    }

    return {
      name: row.name,
      email: row.email ?? null,
      photoUri: row.photo_uri ?? null,
    };
  }
}

// Update the user's profile name, email, and photo via Java backend (or queue offline)
export async function updateUserProfile(
  userId: number,
  name: string,
  email: string | null,
  photoUri: string | null
): Promise<UserProfile> {
  const cleanName = name.trim();
  const cleanEmail = email ? email.trim() : null;

  if (!cleanName) {
    throw new Error('Display name is required.');
  }

  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    const updated = await apiUpdateUserProfile(cleanName, cleanEmail, photoUri);
    await saveProfileLocally(userId, updated.name, updated.email, updated.photoUri);
    return updated;
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Could not update user profile.');
    }

    await saveProfileLocally(userId, cleanName, cleanEmail, photoUri);
    await enqueueOfflineAction(userId, 'UPDATE_PROFILE', {
      name: cleanName,
      email: cleanEmail,
      photoUri,
    });

    return {
      name: cleanName,
      email: cleanEmail,
      photoUri,
    };
  }
}

// Clear the profile photo column via Java backend (or queue offline)
export async function removeUserProfilePhoto(userId: number): Promise<void> {
  const db = await getDatabase();

  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    await apiRemoveProfilePhoto();
    await db.runAsync('UPDATE user_profile SET photo_uri = NULL WHERE user_id = ?;', [userId]);
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Could not remove profile photo.');
    }

    await db.runAsync('UPDATE user_profile SET photo_uri = NULL WHERE user_id = ?;', [userId]);
    await enqueueOfflineAction(userId, 'REMOVE_PHOTO', {});
  }
}

// Get saved notification reminder settings for a user
export async function getReminderSettings(userId: number): Promise<ReminderSettings> {
  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    const settings = await apiGetUserSettings();
    const reminders: ReminderSettings = {
      waterEnabled: settings.waterEnabled,
      waterTime1: settings.waterTime1 || '09:00',
      waterTime2: settings.waterTime2 || '13:00',
      waterTime3: settings.waterTime3 || '17:00',
      dailyEnabled: settings.dailyEnabled,
      dailyTime: settings.dailyTime || '20:30',
      scheduledIds: Array.isArray(settings.scheduledIds) ? settings.scheduledIds : [],
    };
    await saveRemindersLocally(userId, reminders);
    return reminders;
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Could not load reminder settings.');
    }

    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      water_enabled: number;
      water_time1: string;
      water_time2: string;
      water_time3: string;
      daily_enabled: number;
      daily_time: string;
      scheduled_ids: string;
    }>('SELECT * FROM reminder_settings WHERE user_id = ?;', [userId]);

    if (!row) {
      return DEFAULT_REMINDER_SETTINGS;
    }

    let scheduledIds: string[] = [];
    try {
      scheduledIds = JSON.parse(row.scheduled_ids);
    } catch {
      scheduledIds = [];
    }

    return {
      waterEnabled: Boolean(row.water_enabled),
      waterTime1: row.water_time1 || '09:00',
      waterTime2: row.water_time2 || '13:00',
      waterTime3: row.water_time3 || '17:00',
      dailyEnabled: Boolean(row.daily_enabled),
      dailyTime: row.daily_time || '20:30',
      scheduledIds,
    };
  }
}

// Save notification reminder settings via Java backend (or queue offline)
export async function saveReminderSettings(
  userId: number,
  settings: ReminderSettings
): Promise<void> {
  await saveRemindersLocally(userId, settings);

  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    await apiUpdateReminderSettings(settings);
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Could not save reminder settings.');
    }

    await enqueueOfflineAction(userId, 'UPDATE_REMINDERS', { ...settings });
  }
}

// Get the user's saved theme mode ('system', 'light', or 'dark')
export async function getUserTheme(userId: number): Promise<'system' | 'light' | 'dark'> {
  const db = await getDatabase();

  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    const settings = await apiGetUserSettings();
    const mode = settings.themeMode || 'system';
    await db.runAsync(
      `INSERT INTO app_settings (user_id, theme_mode)
       VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET theme_mode = excluded.theme_mode;`,
      [userId, mode]
    );
    return mode;
  } catch {
    const row = await db.getFirstAsync<{ theme_mode: string }>(
      'SELECT theme_mode FROM app_settings WHERE user_id = ?;',
      [userId]
    );

    if (
      row &&
      (row.theme_mode === 'light' || row.theme_mode === 'dark' || row.theme_mode === 'system')
    ) {
      return row.theme_mode;
    }

    return 'system';
  }
}

// Save the user's preferred theme mode via Java backend (or queue offline)
export async function saveUserTheme(
  userId: number,
  themeMode: 'system' | 'light' | 'dark'
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_settings (user_id, theme_mode)
     VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET theme_mode = excluded.theme_mode;`,
    [userId, themeMode]
  );

  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    await apiUpdateThemeMode(themeMode);
  } catch (error) {
    if (isNetworkOfflineError(error)) {
      await enqueueOfflineAction(userId, 'UPDATE_THEME', { themeMode });
    }
  }
}
