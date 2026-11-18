import { z } from "zod";
import type { SQLiteDatabase } from "expo-sqlite";

// Constants
import { QADA_ENTRY_STATUS, QADA_ENTRY_TYPE, type QadaEntryStatus } from "@/constants/Qada";

// Utils
import { sharedDb } from "@/services/db";

import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("qada");

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
  count: z.number(),
  type: z.enum(QADA_ENTRY_TYPE),
  status: z.enum(QADA_ENTRY_STATUS),
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

// ---------------------------------------------------------------------------
// Internal helpers — take the connection so they can be composed inside a single
// sharedDb.run() without re-entering the (non-reentrant) shared lock.
// ---------------------------------------------------------------------------

// Row 1 is the singleton these tables hold; the schema does not constrain it, and every
// write targets `id = 1`, so the reads name it too rather than taking whatever row comes first.
// Completing days mutates the original `added` entry — a partial completion only
// decrements its count — so the entry itself never records when the days were made up.
// This ledger row is that record, and it is what "completed today" is counted from.
// Returns the row's id.
const recordCompletionWith = async (
  db: SQLiteDatabase,
  days: number,
  now: string
): Promise<number> => {
  const { lastInsertRowId } = await db.runAsync(
    `INSERT INTO ${QADA_HISTORY_TABLE} (count, type, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
    [days, QADA_ENTRY_TYPE.COMPLETED, QADA_ENTRY_STATUS.COMPLETED, null, now, now]
  );
  return lastInsertRowId;
};

const getQadaFastWith = async (db: SQLiteDatabase): Promise<QadaFast | null> => {
  const result = await db.getFirstAsync<QadaFast>(
    `SELECT * FROM ${QADA_FASTS_TABLE} WHERE id = 1;`
  );
  return result || null;
};

const updateQadaFastWith = async (
  db: SQLiteDatabase,
  totalMissed: number,
  totalCompleted: number
): Promise<void> => {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE ${QADA_FASTS_TABLE} SET total_missed = ?, total_completed = ?, updated_at = ? WHERE id = 1;`,
    [totalMissed, totalCompleted, now]
  );
};

const getSettingsWith = async (db: SQLiteDatabase): Promise<QadaSettings | null> => {
  const result = await db.getFirstAsync<QadaSettings>(
    `SELECT * FROM ${QADA_SETTINGS_TABLE} WHERE id = 1;`
  );
  return result || null;
};

/**
 * Initialize Qada database tables
 */
const initializeDB = () =>
  sharedDb.run(async (db) => {
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
      const existingFast = await getQadaFastWith(db);

      if (!existingFast) {
        const now = new Date().toISOString();
        await db.runAsync(
          `INSERT INTO ${QADA_FASTS_TABLE} (total_missed, total_completed, created_at, updated_at) VALUES (?, ?, ?, ?);`,
          [0, 0, now, now]
        );
      }

      const existingSettings = await getSettingsWith(db);

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
  });

/**
 * Get current Qada fast data
 */
const getQadaFast = (): Promise<QadaFast | null> =>
  sharedDb.run(async (db) => {
    try {
      return await getQadaFastWith(db);
    } catch (error) {
      console.error("[Qada DB] Error getting Qada fast:", error);
      return null;
    }
  });

/**
 * Update Qada fast counts
 */
const updateQadaFast = (totalMissed: number, totalCompleted: number): Promise<boolean> =>
  sharedDb.run(async (db) => {
    try {
      await updateQadaFastWith(db, totalMissed, totalCompleted);
      return true;
    } catch (error) {
      console.error("[Qada DB] Error updating Qada fast:", error);
      return false;
    }
  });

/**
 * Add missed fasts
 */
const addMissedFasts = (count: number, notes?: string): Promise<boolean> =>
  sharedDb.run(async (db) => {
    try {
      const currentData = await getQadaFastWith(db);

      if (!currentData) {
        console.error("[Qada DB] No Qada data found");
        return false;
      }

      const newTotalMissed = currentData.total_missed + count;
      await updateQadaFastWith(db, newTotalMissed, currentData.total_completed);

      // Add to history
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO ${QADA_HISTORY_TABLE} (count, type, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
        [count, QADA_ENTRY_TYPE.ADDED, QADA_ENTRY_STATUS.PENDING, notes || null, now, now]
      );

      return true;
    } catch (error) {
      console.error("[Qada DB] Error adding missed fasts:", error);
      return false;
    }
  });

/**
 * Get Qada history entries
 */
const getHistory = (limit?: number): Promise<QadaHistory[]> =>
  sharedDb.run(async (db) => {
    try {
      // Completion ledger rows are bookkeeping, not entries the user created, so the
      // visible history lists only what they added.
      const query = limit
        ? `SELECT * FROM ${QADA_HISTORY_TABLE} WHERE type = ? ORDER BY created_at DESC LIMIT ?;`
        : `SELECT * FROM ${QADA_HISTORY_TABLE} WHERE type = ? ORDER BY created_at DESC;`;

      const results = limit
        ? await db.getAllAsync<QadaHistory>(query, [QADA_ENTRY_TYPE.ADDED, limit])
        : await db.getAllAsync<QadaHistory>(query, [QADA_ENTRY_TYPE.ADDED]);

      return results || [];
    } catch (error) {
      log.e("DB", "getHistory failed", error instanceof Error ? error : undefined);
      return [];
    }
  });

/**
 * Get Qada settings
 */
const getSettings = (): Promise<QadaSettings | null> =>
  sharedDb.run(async (db) => {
    try {
      return await getSettingsWith(db);
    } catch (error) {
      console.error("[Qada DB] Error getting settings:", error);
      return null;
    }
  });

/**
 * Update Qada settings
 */
const updateSettings = (
  settings: Partial<Omit<QadaSettings, "id" | "created_at" | "updated_at">>
): Promise<boolean> =>
  sharedDb.run(async (db) => {
    try {
      const now = new Date().toISOString();

      const currentSettings = await getSettingsWith(db);
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
  });

/**
 * Complete one day from an entry; resolves to the recorded day's ledger id, or null.
 */
const completeOneDayFromEntry = (id: number): Promise<number | null> =>
  sharedDb.run(async (db) => {
    try {
      const now = new Date().toISOString();

      // Get the entry to check current status and count
      const entry = await db.getFirstAsync<QadaHistory>(
        `SELECT * FROM ${QADA_HISTORY_TABLE} WHERE id = ?;`,
        [id]
      );

      if (!entry) {
        console.error("[Qada DB] Entry not found for ID:", id);
        return null;
      }

      console.log("[Qada DB] Completing one day from entry ID:", id, "current count:", entry.count);

      if (entry.count > 1) {
        // Reduce count by 1 and keep entry pending
        const newCount = entry.count - 1;
        await db.runAsync(
          `UPDATE ${QADA_HISTORY_TABLE} SET count = ?, updated_at = ? WHERE id = ?;`,
          [newCount, now, id]
        );
        console.log("[Qada DB] Reduced entry count to:", newCount);
      } else {
        // Mark single-count entry as completed
        await db.runAsync(
          `UPDATE ${QADA_HISTORY_TABLE} SET status = ?, updated_at = ? WHERE id = ?;`,
          [QADA_ENTRY_STATUS.COMPLETED, now, id]
        );
        console.log("[Qada DB] Marked single-count entry as completed");
      }

      // Update totals: increment completed, decrement missed
      const currentData = await getQadaFastWith(db);
      if (!currentData) {
        console.error("[Qada DB] No Qada data found");
        return null;
      }

      const newTotalCompleted = currentData.total_completed + 1;
      const newTotalMissed = currentData.total_missed - 1;
      await updateQadaFastWith(db, newTotalMissed, newTotalCompleted);
      const completionId = await recordCompletionWith(db, 1, now);
      console.log(
        "[Qada DB] Updated totals - completed:",
        newTotalCompleted,
        "missed:",
        newTotalMissed
      );

      return completionId;
    } catch (error) {
      console.error("[Qada DB] Error completing one day from entry:", error);
      return null;
    }
  });

/**
 * Update entry status (for swipe actions)
 */
const updateEntryStatus = (id: number, status: QadaEntryStatus): Promise<boolean> =>
  sharedDb.run(async (db) => {
    try {
      const now = new Date().toISOString();

      // Get the entry to check current status and update totals if needed
      const entry = await db.getFirstAsync<QadaHistory>(
        `SELECT * FROM ${QADA_HISTORY_TABLE} WHERE id = ?;`,
        [id]
      );

      if (!entry) {
        console.error("[Qada DB] Entry not found for ID:", id);
        return false;
      }

      console.log(
        "[Qada DB] Updating entry ID:",
        id,
        "from status:",
        entry.status,
        "to status:",
        status
      );

      // Update entry status
      await db.runAsync(
        `UPDATE ${QADA_HISTORY_TABLE} SET status = ?, updated_at = ? WHERE id = ?;`,
        [status, now, id]
      );

      // Update totals based on status change
      const currentData = await getQadaFastWith(db);
      if (!currentData) {
        console.error("[Qada DB] No Qada data found");
        return false;
      }

      // If marking a pending entry as completed
      if (
        entry.status === QADA_ENTRY_STATUS.PENDING &&
        status === QADA_ENTRY_STATUS.COMPLETED &&
        entry.type === QADA_ENTRY_TYPE.ADDED
      ) {
        const newTotalCompleted = currentData.total_completed + entry.count;
        const newTotalMissed = Math.max(0, currentData.total_missed - entry.count);
        await updateQadaFastWith(db, newTotalMissed, newTotalCompleted);
        await recordCompletionWith(db, entry.count, now);

        console.log(
          "[Qada DB] Completed entry ID:",
          entry.id,
          "- completed",
          entry.count,
          "days.",
          "New total_missed:",
          newTotalMissed,
          "total_completed:",
          newTotalCompleted
        );
      }

      // If marking a pending entry as deleted
      if (
        entry.status === QADA_ENTRY_STATUS.PENDING &&
        status === QADA_ENTRY_STATUS.DELETED &&
        entry.type === QADA_ENTRY_TYPE.ADDED
      ) {
        // Only subtract remaining days from missed - keep completed days as historical record
        const newTotalMissed = Math.max(0, currentData.total_missed - entry.count);

        await updateQadaFastWith(db, newTotalMissed, currentData.total_completed);

        console.log(
          "[Qada DB] Deleted entry ID:",
          entry.id,
          "- removed",
          entry.count,
          "remaining days.",
          "New total_missed:",
          newTotalMissed,
          "total_completed:",
          currentData.total_completed
        );
      }

      return true;
    } catch (error) {
      console.error("[Qada DB] Error updating entry status:", error);
      return false;
    }
  });

/**
 * Get pending entries only
 */
const getPendingEntries = (): Promise<QadaHistory[]> =>
  sharedDb.run(async (db) => {
    try {
      const results = await db.getAllAsync<QadaHistory>(
        `SELECT * FROM ${QADA_HISTORY_TABLE} WHERE status = ? ORDER BY created_at DESC;`,
        [QADA_ENTRY_STATUS.PENDING]
      );
      return results || [];
    } catch (error) {
      log.e("DB", "getPendingEntries failed", error instanceof Error ? error : undefined);
      return [];
    }
  });

/**
 * Recorded days, newest first: the completion ledger.
 */
const getCompletions = (limit?: number): Promise<QadaHistory[]> =>
  sharedDb.run(async (db) => {
    try {
      const query = `SELECT * FROM ${QADA_HISTORY_TABLE} WHERE type = ? ORDER BY created_at DESC, id DESC${limit ? " LIMIT ?" : ""};`;
      const params = limit ? [QADA_ENTRY_TYPE.COMPLETED, limit] : [QADA_ENTRY_TYPE.COMPLETED];
      return (await db.getAllAsync<QadaHistory>(query, params)) || [];
    } catch (error) {
      log.e("DB", "getCompletions failed", error instanceof Error ? error : undefined);
      return [];
    }
  });

// The ledger row names no batch, so the days go to the oldest open batch, else
// back into the batch finished last, else into a new batch.
const returnDaysWith = async (db: SQLiteDatabase, days: number, now: string): Promise<void> => {
  const open = await db.getFirstAsync<QadaHistory>(
    `SELECT * FROM ${QADA_HISTORY_TABLE} WHERE type = ? AND status = ? ORDER BY created_at ASC, id ASC LIMIT 1;`,
    [QADA_ENTRY_TYPE.ADDED, QADA_ENTRY_STATUS.PENDING]
  );
  if (open) {
    await db.runAsync(`UPDATE ${QADA_HISTORY_TABLE} SET count = ?, updated_at = ? WHERE id = ?;`, [
      open.count + days,
      now,
      open.id,
    ]);
    return;
  }
  const finished = await db.getFirstAsync<QadaHistory>(
    `SELECT * FROM ${QADA_HISTORY_TABLE} WHERE type = ? AND status = ? ORDER BY updated_at DESC, id DESC LIMIT 1;`,
    [QADA_ENTRY_TYPE.ADDED, QADA_ENTRY_STATUS.COMPLETED]
  );
  if (finished) {
    await db.runAsync(
      `UPDATE ${QADA_HISTORY_TABLE} SET count = ?, status = ?, updated_at = ? WHERE id = ?;`,
      [days, QADA_ENTRY_STATUS.PENDING, now, finished.id]
    );
    return;
  }
  await db.runAsync(
    `INSERT INTO ${QADA_HISTORY_TABLE} (count, type, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
    [days, QADA_ENTRY_TYPE.ADDED, QADA_ENTRY_STATUS.PENDING, null, now, now]
  );
};

/**
 * The id of the day recorded last; ids grow with each insert, unlike the device clock.
 */
const getNewestCompletionId = (): Promise<number | null> =>
  sharedDb.run(async (db) => {
    try {
      const row = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM ${QADA_HISTORY_TABLE} WHERE type = ? ORDER BY id DESC LIMIT 1;`,
        [QADA_ENTRY_TYPE.COMPLETED]
      );
      return row?.id ?? null;
    } catch (error) {
      log.e("DB", "getNewestCompletionId failed", error instanceof Error ? error : undefined);
      return null;
    }
  });

/** Thrown inside the restore transaction to roll it back. */
class RestoreMissed extends Error {}

/**
 * Unrecords a day: drops its ledger row and owes its days again, all or nothing.
 */
const restoreCompletion = (completionId: number): Promise<boolean> =>
  sharedDb.run(async (db) => {
    try {
      const row = await db.getFirstAsync<QadaHistory>(
        `SELECT * FROM ${QADA_HISTORY_TABLE} WHERE id = ? AND type = ?;`,
        [completionId, QADA_ENTRY_TYPE.COMPLETED]
      );
      const totals = await getQadaFastWith(db);
      if (!row || !totals) return false;

      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        const { changes } = await db.runAsync(
          `DELETE FROM ${QADA_HISTORY_TABLE} WHERE id = ? AND type = ?;`,
          [completionId, QADA_ENTRY_TYPE.COMPLETED]
        );
        if (changes !== 1) throw new RestoreMissed();
        await returnDaysWith(db, row.count, now);
        await updateQadaFastWith(
          db,
          totals.total_missed + row.count,
          Math.max(0, totals.total_completed - row.count)
        );
      });
      return true;
    } catch (error) {
      if (!(error instanceof RestoreMissed)) {
        log.e("DB", "restoreCompletion failed", error instanceof Error ? error : undefined);
      }
      return false;
    }
  });

/**
 * Reset all Qada data
 */
const resetAll = (): Promise<boolean> =>
  sharedDb.run(async (db) => {
    try {
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
  });

/**
 * Get the remaining count directly from the database
 * This avoids circular dependency between qada and notification stores
 */
const getRemainingCount = async (): Promise<number> => {
  try {
    const qadaFast = await getQadaFast();
    return Math.max(0, qadaFast?.total_missed ?? 0);
  } catch (error) {
    console.error("[Qada DB] Error getting remaining count:", error);
    return 0;
  }
};

// Days made up between two UTC instants. `updated_at` is written with
// `toISOString()`, so ISO bounds compare correctly as text. Sums the days, not the
// rows: completing a multi-day entry writes one ledger row carrying its whole count.
export const getCompletedCountBetweenWith = async (
  db: SQLiteDatabase,
  startIso: string,
  endIso: string
): Promise<number> => {
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(count), 0) AS total FROM ${QADA_HISTORY_TABLE}
     WHERE type = ? AND updated_at >= ? AND updated_at < ?;`,
    [QADA_ENTRY_TYPE.COMPLETED, startIso, endIso]
  );
  return row?.total ?? 0;
};

const getCompletedCountBetween = (startIso: string, endIso: string): Promise<number> =>
  sharedDb.run((db) => getCompletedCountBetweenWith(db, startIso, endIso));

export const QadaDB = {
  initialize: initializeDB,
  getQadaFast,
  updateQadaFast,
  addMissedFasts,
  getHistory,
  getPendingEntries,
  updateEntryStatus,
  completeOneDayFromEntry,
  getNewestCompletionId,
  getCompletions,
  restoreCompletion,
  getSettings,
  updateSettings,
  resetAll,
  getRemainingCount,
  getCompletedCountBetween,
};
