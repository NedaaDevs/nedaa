import * as SQLite from "expo-sqlite";
import { z } from "zod";

// Constants
import { DB_NAME } from "@/constants/DB";

// Utils
import { getDirectory } from "@/services/db";

// Table names
export const QADA_FASTS_TABLE = "qada_fasts" as const;
export const QADA_HISTORY_TABLE = "qada_history" as const;
export const QADA_SETTINGS_TABLE = "qada_settings" as const;

// Schemas
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const QadaFastSchema = z.object({
  id: z.number(),
  total_missed: z.number(),
  total_completed: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const QadaHistorySchema = z.object({
  id: z.number(),
  date: z.string(),
  count: z.number(),
  type: z.enum(["completed", "added", "removed"]),
  status: z.enum(["pending", "completed", "deleted"]),
  notes: z.string().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const QadaSettingsSchema = z.object({
  id: z.number(),
  reminder_type: z.enum(["none", "ramadan", "custom"]),
  reminder_days: z.number().nullable(),
  custom_date: z.string().nullable(),
  privacy_mode: z.number(), // SQLite stores boolean as 0/1
  created_at: z.string(),
  updated_at: z.string(),
});

// Types
export type QadaFast = z.infer<typeof QadaFastSchema>;
export type QadaHistory = z.infer<typeof QadaHistorySchema>;
export type QadaSettings = z.infer<typeof QadaSettingsSchema>;

// Open Database
const openDatabase = async () =>
  await SQLite.openDatabaseAsync(
    DB_NAME,
    {
      useNewConnection: true,
    },
    await getDirectory()
  );

/**
 * Initialize Qada database tables
 */
const initializeDB = async () => {
  const db = await openDatabase();

  try {
    // Create qada_fasts table
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${QADA_FASTS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_missed INTEGER NOT NULL DEFAULT 0,
        total_completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`
    );

    // Create qada_history table
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${QADA_HISTORY_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        count INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('completed', 'added', 'removed')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'deleted')),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`
    );

    // Create qada_settings table
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${QADA_SETTINGS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reminder_type TEXT NOT NULL DEFAULT 'none' CHECK(reminder_type IN ('none', 'ramadan', 'custom')),
        reminder_days INTEGER,
        custom_date TEXT,
        privacy_mode INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`
    );

    // Initialize default records if they don't exist
    const existingFast = await db.getFirstAsync<QadaFast>(
      `SELECT * FROM ${QADA_FASTS_TABLE} LIMIT 1;`
    );

    if (!existingFast) {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO ${QADA_FASTS_TABLE} (total_missed, total_completed, created_at, updated_at) VALUES (?, ?, ?, ?);`,
        [0, 0, now, now]
      );
    }

    const existingSettings = await db.getFirstAsync<QadaSettings>(
      `SELECT * FROM ${QADA_SETTINGS_TABLE} LIMIT 1;`
    );

    if (!existingSettings) {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO ${QADA_SETTINGS_TABLE} (reminder_type, reminder_days, custom_date, privacy_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
        ["none", null, null, 0, now, now]
      );
    }

    console.log("[Qada DB] Database initialized successfully");
  } catch (error: unknown) {
    console.error("[Qada DB] Error initializing database:", error);
    throw error;
  }
};

/**
 * Get current Qada fast data
 */
const getQadaFast = async (): Promise<QadaFast | null> => {
  try {
    const db = await openDatabase();
    const result = await db.getFirstAsync<QadaFast>(`SELECT * FROM ${QADA_FASTS_TABLE} LIMIT 1;`);
    return result || null;
  } catch (error) {
    console.error("[Qada DB] Error getting Qada fast:", error);
    return null;
  }
};

/**
 * Update Qada fast counts
 */
const updateQadaFast = async (totalMissed: number, totalCompleted: number): Promise<boolean> => {
  try {
    const db = await openDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE ${QADA_FASTS_TABLE} SET total_missed = ?, total_completed = ?, updated_at = ? WHERE id = 1;`,
      [totalMissed, totalCompleted, now]
    );

    return true;
  } catch (error) {
    console.error("[Qada DB] Error updating Qada fast:", error);
    return false;
  }
};

/**
 * Add missed fasts
 */
const addMissedFasts = async (count: number, notes?: string): Promise<boolean> => {
  try {
    const db = await openDatabase();
    const currentData = await getQadaFast();

    if (!currentData) {
      console.error("[Qada DB] No Qada data found");
      return false;
    }

    const newTotalMissed = currentData.total_missed + count;
    await updateQadaFast(newTotalMissed, currentData.total_completed);

    // Add to history
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO ${QADA_HISTORY_TABLE} (date, count, type, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [now, count, "added", "pending", notes || null, now, now]
    );

    return true;
  } catch (error) {
    console.error("[Qada DB] Error adding missed fasts:", error);
    return false;
  }
};

/**
 * Mark fasts as completed
 */
const markCompleted = async (count: number, date?: string, notes?: string): Promise<boolean> => {
  try {
    const db = await openDatabase();
    const currentData = await getQadaFast();

    if (!currentData) {
      console.error("[Qada DB] No Qada data found");
      return false;
    }

    // Don't allow completing more than remaining
    const remaining = currentData.total_missed - currentData.total_completed;
    if (count > remaining) {
      console.error("[Qada DB] Cannot complete more fasts than remaining");
      return false;
    }

    const newTotalCompleted = currentData.total_completed + count;
    await updateQadaFast(currentData.total_missed, newTotalCompleted);

    // Add to history
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO ${QADA_HISTORY_TABLE} (date, count, type, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [date || now, count, "completed", "completed", notes || null, now, now]
    );

    return true;
  } catch (error) {
    console.error("[Qada DB] Error marking fasts as completed:", error);
    return false;
  }
};

/**
 * Get Qada history entries
 */
const getHistory = async (limit?: number): Promise<QadaHistory[]> => {
  try {
    const db = await openDatabase();
    const query = limit
      ? `SELECT * FROM ${QADA_HISTORY_TABLE} ORDER BY created_at DESC LIMIT ?;`
      : `SELECT * FROM ${QADA_HISTORY_TABLE} ORDER BY created_at DESC;`;

    const results = limit
      ? await db.getAllAsync<QadaHistory>(query, [limit])
      : await db.getAllAsync<QadaHistory>(query);

    return results || [];
  } catch (error) {
    console.error("[Qada DB] Error getting history:", error);
    return [];
  }
};

/**
 * Get Qada settings
 */
const getSettings = async (): Promise<QadaSettings | null> => {
  try {
    const db = await openDatabase();
    const result = await db.getFirstAsync<QadaSettings>(
      `SELECT * FROM ${QADA_SETTINGS_TABLE} LIMIT 1;`
    );
    return result || null;
  } catch (error) {
    console.error("[Qada DB] Error getting settings:", error);
    return null;
  }
};

/**
 * Update Qada settings
 */
const updateSettings = async (
  settings: Partial<Omit<QadaSettings, "id" | "created_at" | "updated_at">>
): Promise<boolean> => {
  try {
    const db = await openDatabase();
    const now = new Date().toISOString();

    const currentSettings = await getSettings();
    if (!currentSettings) {
      console.error("[Qada DB] No settings found");
      return false;
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (settings.reminder_type !== undefined) {
      updates.push("reminder_type = ?");
      values.push(settings.reminder_type);
    }
    if (settings.reminder_days !== undefined) {
      updates.push("reminder_days = ?");
      values.push(settings.reminder_days);
    }
    if (settings.custom_date !== undefined) {
      updates.push("custom_date = ?");
      values.push(settings.custom_date);
    }
    if (settings.privacy_mode !== undefined) {
      updates.push("privacy_mode = ?");
      values.push(settings.privacy_mode ? 1 : 0);
    }

    if (updates.length === 0) {
      return true; // Nothing to update
    }

    updates.push("updated_at = ?");
    values.push(now);

    const query = `UPDATE ${QADA_SETTINGS_TABLE} SET ${updates.join(", ")} WHERE id = 1;`;
    await db.runAsync(query, values);

    return true;
  } catch (error) {
    console.error("[Qada DB] Error updating settings:", error);
    return false;
  }
};

/**
 * Update entry status (for swipe actions)
 */
const updateEntryStatus = async (
  id: number,
  status: "pending" | "completed" | "deleted"
): Promise<boolean> => {
  try {
    const db = await openDatabase();
    const now = new Date().toISOString();

    // Get the entry to check current status and update totals if needed
    const entry = await db.getFirstAsync<QadaHistory>(
      `SELECT * FROM ${QADA_HISTORY_TABLE} WHERE id = ?;`,
      [id]
    );

    if (!entry) {
      console.error("[Qada DB] Entry not found");
      return false;
    }

    // Update entry status
    await db.runAsync(`UPDATE ${QADA_HISTORY_TABLE} SET status = ?, updated_at = ? WHERE id = ?;`, [
      status,
      now,
      id,
    ]);

    // Update totals based on status change
    const currentData = await getQadaFast();
    if (!currentData) {
      console.error("[Qada DB] No Qada data found");
      return false;
    }

    // If marking a pending entry as completed
    if (entry.status === "pending" && status === "completed" && entry.type === "added") {
      const newTotalCompleted = currentData.total_completed + entry.count;
      await updateQadaFast(currentData.total_missed, newTotalCompleted);
    }

    // If marking a pending entry as deleted
    if (entry.status === "pending" && status === "deleted" && entry.type === "added") {
      const newTotalMissed = currentData.total_missed - entry.count;
      await updateQadaFast(newTotalMissed, currentData.total_completed);
    }

    return true;
  } catch (error) {
    console.error("[Qada DB] Error updating entry status:", error);
    return false;
  }
};

/**
 * Get pending entries only
 */
const getPendingEntries = async (): Promise<QadaHistory[]> => {
  try {
    const db = await openDatabase();
    const results = await db.getAllAsync<QadaHistory>(
      `SELECT * FROM ${QADA_HISTORY_TABLE} WHERE status = 'pending' AND type = 'added' ORDER BY created_at DESC;`
    );
    return results || [];
  } catch (error) {
    console.error("[Qada DB] Error getting pending entries:", error);
    return [];
  }
};

/**
 * Delete a history entry
 */
const deleteHistoryEntry = async (id: number): Promise<boolean> => {
  try {
    const db = await openDatabase();
    await db.runAsync(`DELETE FROM ${QADA_HISTORY_TABLE} WHERE id = ?;`, [id]);
    return true;
  } catch (error) {
    console.error("[Qada DB] Error deleting history entry:", error);
    return false;
  }
};

/**
 * Reset all Qada data
 */
const resetAll = async (): Promise<boolean> => {
  try {
    const db = await openDatabase();
    const now = new Date().toISOString();

    // Reset fasts
    await db.runAsync(
      `UPDATE ${QADA_FASTS_TABLE} SET total_missed = 0, total_completed = 0, updated_at = ? WHERE id = 1;`,
      [now]
    );

    // Clear history
    await db.runAsync(`DELETE FROM ${QADA_HISTORY_TABLE};`);

    return true;
  } catch (error) {
    console.error("[Qada DB] Error resetting data:", error);
    return false;
  }
};

export const QadaDB = {
  initialize: initializeDB,
  getQadaFast,
  updateQadaFast,
  addMissedFasts,
  markCompleted,
  getHistory,
  getPendingEntries,
  updateEntryStatus,
  getSettings,
  updateSettings,
  deleteHistoryEntry,
  resetAll,
};
