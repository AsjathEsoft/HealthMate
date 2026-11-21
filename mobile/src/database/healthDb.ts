// Functions for daily health records and daily goals
// Uses the Java Spring Boot REST API when online and falls back to local SQLite + offline sync queue when offline

import {
  enqueueOfflineAction,
  getDatabase,
  syncOfflineChangesWithBackend,
} from './db';
import {
  NetworkOfflineError,
  apiAddHealthRecord,
  apiDeleteHealthRecord,
  apiDeleteHealthRecordByDate,
  apiGetDailyGoals,
  apiGetHealthRecords,
  apiUpdateDailyGoals,
  apiUpdateHealthRecord,
  isNetworkOfflineError,
} from '../services/api';
import { isValidCalendarDate } from '../utils/validation';

export interface HealthRecord {
  id: number;
  userId: number;
  date: string;
  steps: number;
  calories: number;
  water: number;
}

export interface DailyGoals {
  steps: number;
  calories: number;
  water: number;
}

export const DEFAULT_DAILY_GOALS: DailyGoals = {
  steps: 8000,
  calories: 2000,
  water: 2000,
};

// Read all health records for a user from Android's local SQLite cache
async function readLocalHealthRecords(userId: number): Promise<HealthRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    user_id: number;
    date: string;
    steps: number;
    calories: number;
    water: number;
  }>(
    'SELECT id, user_id, date, steps, calories, water FROM health_records WHERE user_id = ? ORDER BY date DESC;',
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    date: row.date,
    steps: row.steps,
    calories: row.calories,
    water: row.water,
  }));
}

// Mirror a single authoritative server record into Android's local SQLite cache
async function saveServerRecordLocally(record: HealthRecord, previousDate?: string): Promise<void> {
  const db = await getDatabase();
  if (previousDate && previousDate !== record.date) {
    await db.runAsync('DELETE FROM health_records WHERE user_id = ? AND date = ?;', [
      record.userId,
      previousDate,
    ]);
  }
  await db.runAsync('DELETE FROM health_records WHERE user_id = ? AND date = ?;', [
    record.userId,
    record.date,
  ]);
  await db.runAsync(
    `INSERT OR REPLACE INTO health_records (id, user_id, date, steps, calories, water)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [record.id, record.userId, record.date, record.steps, record.calories, record.water]
  );
}

// Get all health records for a user, ordered from newest date to oldest
export async function getHealthRecords(userId: number): Promise<HealthRecord[]> {
  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      return await readLocalHealthRecords(userId);
    }

    const serverRecords = await apiGetHealthRecords();
    const db = await getDatabase();

    // Update local mirror for this user with the authoritative records from Java
    for (const rec of serverRecords) {
      await saveServerRecordLocally(rec);
    }

    if (serverRecords.length === 0) {
      await db.runAsync('DELETE FROM health_records WHERE user_id = ?;', [userId]);
    } else {
      const placeholders = serverRecords.map(() => '?').join(', ');
      await db.runAsync(
        `DELETE FROM health_records WHERE user_id = ? AND id NOT IN (${placeholders});`,
        [userId, ...serverRecords.map((rec) => rec.id)]
      );
    }

    return serverRecords;
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Failed to load health records.');
    }

    return await readLocalHealthRecords(userId);
  }
}

// Add a new daily health record for a user
export async function addHealthRecord(
  userId: number,
  date: string,
  steps: number,
  calories: number,
  water: number
): Promise<HealthRecord> {
  const cleanDate = date.trim();

  if (!isValidCalendarDate(cleanDate)) {
    throw new Error('Please choose a valid calendar date (YYYY-MM-DD).');
  }

  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    const created = await apiAddHealthRecord(cleanDate, steps, calories, water, false);
    await saveServerRecordLocally(created);
    return created;
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Could not save health record.');
    }

    // Offline fallback: save locally and queue for automatic sync when Java server reconnects
    const db = await getDatabase();
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM health_records WHERE user_id = ? AND date = ?;',
      [userId, cleanDate]
    );

    if (existing) {
      throw new Error(
        `A health record for ${cleanDate} already exists. Only one record per date is allowed.`
      );
    }

    const result = await db.runAsync(
      'INSERT INTO health_records (user_id, date, steps, calories, water) VALUES (?, ?, ?, ?, ?);',
      [userId, cleanDate, steps, calories, water]
    );

    await enqueueOfflineAction(userId, 'UPSERT_RECORD', {
      date: cleanDate,
      steps,
      calories,
      water,
    });


    return {
      id: Number(result.lastInsertRowId),
      userId,
      date: cleanDate,
      steps,
      calories,
      water,
    };
  }
}

// Update an existing daily health record
export async function updateHealthRecord(
  recordId: number,
  userId: number,
  date: string,
  steps: number,
  calories: number,
  water: number
): Promise<HealthRecord> {
  const cleanDate = date.trim();

  if (!isValidCalendarDate(cleanDate)) {
    throw new Error('Please choose a valid calendar date (YYYY-MM-DD).');
  }

  const db = await getDatabase();
  const localExisting = await db.getFirstAsync<{ id: number; date: string }>(
    'SELECT id, date FROM health_records WHERE id = ? AND user_id = ?;',
    [recordId, userId]
  );

  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    let updated: HealthRecord;
    try {
      updated = await apiUpdateHealthRecord(recordId, cleanDate, steps, calories, water);
    } catch (updateErr) {
      const status = (updateErr as { status?: number })?.status;
      if (status === 404 && localExisting) {
        // Handle case where a locally-created offline record received a new server ID during sync
        if (localExisting.date !== cleanDate) {
          await apiDeleteHealthRecordByDate(localExisting.date);
        }
        updated = await apiAddHealthRecord(cleanDate, steps, calories, water, true);
      } else {
        throw updateErr;
      }
    }

    await db.runAsync('DELETE FROM health_records WHERE id = ? AND user_id = ?;', [
      recordId,
      userId,
    ]);
    await saveServerRecordLocally(updated, localExisting?.date);
    return updated;
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Could not update health record.');
    }

    // Offline fallback: update local SQLite and queue conflict-safe upsert
    if (!localExisting) {
      throw new Error('Health record was not found.');
    }

    const duplicateDate = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM health_records WHERE user_id = ? AND date = ? AND id != ?;',
      [userId, cleanDate, recordId]
    );

    if (duplicateDate) {
      throw new Error(`Another record already exists for ${cleanDate}.`);
    }

    await db.runAsync(
      'UPDATE health_records SET date = ?, steps = ?, calories = ?, water = ? WHERE id = ? AND user_id = ?;',
      [cleanDate, steps, calories, water, recordId, userId]
    );

    await enqueueOfflineAction(userId, 'UPSERT_RECORD', {
      date: cleanDate,
      previousDate: localExisting.date,
      steps,
      calories,
      water,
    });


    return {
      id: recordId,
      userId,
      date: cleanDate,
      steps,
      calories,
      water,
    };
  }
}

// Delete a health record by ID for the logged-in user
export async function deleteHealthRecord(recordId: number, userId: number): Promise<boolean> {
  const db = await getDatabase();
  const localExisting = await db.getFirstAsync<{ id: number; date: string }>(
    'SELECT id, date FROM health_records WHERE id = ? AND user_id = ?;',
    [recordId, userId]
  );

  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    try {
      await apiDeleteHealthRecord(recordId);
    } catch (delErr) {
      const status = (delErr as { status?: number })?.status;
      if (status === 404 && localExisting?.date) {
        await apiDeleteHealthRecordByDate(localExisting.date);
      } else {
        throw delErr;
      }
    }

    await db.runAsync('DELETE FROM health_records WHERE id = ? AND user_id = ?;', [
      recordId,
      userId,
    ]);
    return true;
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Could not delete health record.');
    }

    const result = await db.runAsync(
      'DELETE FROM health_records WHERE id = ? AND user_id = ?;',
      [recordId, userId]
    );

    if (localExisting?.date) {
      await enqueueOfflineAction(userId, 'DELETE_RECORD', { date: localExisting.date });
    }

    if (result.changes > 0) {
      return true;
    }

    return false;
  }
}

// Get the user's daily goals from Java backend (or local SQLite when offline)
export async function getDailyGoals(userId: number): Promise<DailyGoals> {
  const db = await getDatabase();

  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    const serverGoals = await apiGetDailyGoals();
    await db.runAsync(
      `INSERT INTO daily_goals (user_id, steps, calories, water)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         steps = excluded.steps,
         calories = excluded.calories,
         water = excluded.water;`,
      [userId, serverGoals.steps, serverGoals.calories, serverGoals.water]
    );
    return serverGoals;
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Could not load daily goals.');
    }

    const row = await db.getFirstAsync<{
      steps: number;
      calories: number;
      water: number;
    }>('SELECT steps, calories, water FROM daily_goals WHERE user_id = ?;', [userId]);

    if (!row) {
      return DEFAULT_DAILY_GOALS;
    }

    return {
      steps: row.steps,
      calories: row.calories,
      water: row.water,
    };
  }
}

// Save or update daily goals via Java backend (or queue offline)
export async function saveDailyGoals(
  userId: number,
  steps: number,
  calories: number,
  water: number
): Promise<DailyGoals> {
  const db = await getDatabase();

  try {
    const synced = await syncOfflineChangesWithBackend(userId);
    if (!synced) {
      throw new NetworkOfflineError();
    }

    const updated = await apiUpdateDailyGoals(steps, calories, water);
    await db.runAsync(
      `INSERT INTO daily_goals (user_id, steps, calories, water)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         steps = excluded.steps,
         calories = excluded.calories,
         water = excluded.water;`,
      [userId, updated.steps, updated.calories, updated.water]
    );
    return updated;
  } catch (error) {
    if (!isNetworkOfflineError(error)) {
      throw error instanceof Error ? error : new Error('Could not save daily goals.');
    }

    await db.runAsync(
      `INSERT INTO daily_goals (user_id, steps, calories, water)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         steps = excluded.steps,
         calories = excluded.calories,
         water = excluded.water;`,
      [userId, steps, calories, water]
    );

    await enqueueOfflineAction(userId, 'UPDATE_GOALS', { steps, calories, water });

    return { steps, calories, water };
  }
}
