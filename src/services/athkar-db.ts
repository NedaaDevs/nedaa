import * as SQLite from "expo-sqlite";
import { z } from "zod";

// Services
import { getDirectory } from "@/services/db";

// Utils
import { dateToInt, timeZonedNow } from "@/utils/date";
import { AppLogger } from "@/utils/appLogger";
import { createSerializedDatabase } from "@/utils/serializedDatabase";

// Services
import { initializeDailyItemsCore } from "@/services/athkar-daily-init";

// Constants
import {
  ATHKAR_STREAK_TABLE,
  ATHKAR_COMPLETED_DAYS_TABLE,
  ATHKAR_DAILY_ITEMS_TABLE,
  ATHKAR_AUDIO_DOWNLOADS_TABLE,
  ATHKAR_DB_NAME,
  MY_ATHKAR_TABLE,
  MY_ATHKAR_DAILY_TABLE,
  CUSTOM_ATHKAR_GROUPS_TABLE,
  CUSTOM_ATHKAR_ITEMS_TABLE,
  CUSTOM_ATHKAR_DAILY_TABLE,
} from "@/constants/DB";

// Stores
import locationStore from "@/stores/location";

const log = AppLogger.create("athkar-db");

// Schemas
const AthkarStreakSchema = z.object({
  id: z.number(),
  current_streak: z.number().min(0),
  longest_streak: z.number().min(0),
  last_streak_date: z.number().nullable(),
  is_paused: z.number().min(0).max(1),
  tolerance_days: z.number().min(0),
  created_at: z.string(),
  updated_at: z.string(),
});

const AthkarDailyItemSchema = z.object({
  date: z.number(),
  thikr_id: z.string(),
  current_count: z.number().min(0),
  total_count: z.number().min(1),
  created_at: z.string(),
  updated_at: z.string(),
});

const AthkarAudioDownloadSchema = z.object({
  id: z.number(),
  reciter_id: z.string(),
  thikr_id: z.string(),
  file_path: z.string(),
  file_size: z.number().min(0),
  downloaded_at: z.string(),
});

type AthkarStreak = z.infer<typeof AthkarStreakSchema>;
type AthkarDailyItem = z.infer<typeof AthkarDailyItemSchema>;
type AthkarAudioDownload = z.infer<typeof AthkarAudioDownloadSchema>;

// Migration helper for completed days table
const migrateCompletedDaysTable = async (db: SQLite.SQLiteDatabase) => {
  try {
    // Get table structure
    const columns = await db.getAllAsync(`PRAGMA table_info(${ATHKAR_COMPLETED_DAYS_TABLE});`);

    if (!columns || columns.length === 0) {
      // Table doesn't exist yet, nothing to migrate
      return;
    }

    const columnNames = (columns || []).map((col: any) => col.name);
    console.log("[Athkar-DB] Existing columns:", columnNames);

    // Check if we need to add missing columns
    const missingColumns = [];

    if (!columnNames.includes("morning_completed_at")) {
      missingColumns.push("morning_completed_at TEXT NULL");
    }

    if (!columnNames.includes("evening_completed_at")) {
      missingColumns.push("evening_completed_at TEXT NULL");
    }

    if (!columnNames.includes("created_at")) {
      missingColumns.push('created_at TEXT NOT NULL DEFAULT ""');
    }

    if (!columnNames.includes("updated_at")) {
      missingColumns.push('updated_at TEXT NOT NULL DEFAULT ""');
    }

    // Add missing columns
    for (const column of missingColumns) {
      try {
        console.log("[Athkar-DB] Adding column:", column);
        await db.execAsync(`ALTER TABLE ${ATHKAR_COMPLETED_DAYS_TABLE} ADD COLUMN ${column};`);
      } catch (error) {
        console.log("[Athkar-DB] Column already exists or error adding:", column, error);
      }
    }

    // Update empty created_at and updated_at fields if they were just added
    const tz = locationStore.getState().locationDetails.timezone;
    const now = timeZonedNow(tz).toISOString();

    try {
      await db.runAsync(
        `UPDATE ${ATHKAR_COMPLETED_DAYS_TABLE}
         SET created_at = ?, updated_at = ?
         WHERE created_at = '' OR created_at IS NULL OR updated_at = '' OR updated_at IS NULL;`,
        [now, now]
      );
    } catch (error) {
      console.log("[Athkar-DB] Error updating timestamps (non-fatal):", error);
    }

    // Migrate existing completion data if there are old columns
    if (columnNames.includes("completed_at") && !columnNames.includes("morning_completed_at")) {
      console.log("[Athkar-DB] Migrating from completed_at to new schema...");
      try {
        await db.runAsync(
          `UPDATE ${ATHKAR_COMPLETED_DAYS_TABLE}
           SET morning_completed_at = completed_at,
               evening_completed_at = completed_at
           WHERE completed_at IS NOT NULL AND morning_completed_at IS NULL;`
        );
      } catch (error) {
        console.log("[Athkar-DB] Error migrating completed_at (non-fatal):", error);
      }
    } else if (
      columnNames.includes("is_completed") &&
      !columnNames.includes("morning_completed_at")
    ) {
      console.log("[Athkar-DB] Migrating from is_completed to new schema...");
      try {
        await db.runAsync(
          `UPDATE ${ATHKAR_COMPLETED_DAYS_TABLE}
           SET morning_completed_at = ?,
               evening_completed_at = ?
           WHERE is_completed = 1 AND morning_completed_at IS NULL;`,
          [now, now]
        );
      } catch (error) {
        console.log("[Athkar-DB] Error migrating is_completed (non-fatal):", error);
      }
    }

    console.log("[Athkar-DB] Migration completed successfully");
  } catch (error) {
    console.error("[Athkar-DB] Migration error (non-fatal):", error);
    // Don't throw - let the app continue even if migration fails
  }
};

// Builds the schema on a freshly opened connection. Receives db so it can be
// run inside the serialized-database open() callback (never opens its own).
const setupSchema = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  try {
    await db.execAsync(`PRAGMA journal_mode = WAL;`);
    await db.execAsync(`PRAGMA busy_timeout = 3000;`);
    // Create streak table - stores calculated streak values
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${ATHKAR_STREAK_TABLE} (
        id INTEGER PRIMARY KEY,
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        last_streak_date INTEGER,
        is_paused INTEGER NOT NULL DEFAULT 0,
        tolerance_days INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`
    );

    // Create daily items table - individual athkar progress
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${ATHKAR_DAILY_ITEMS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date INTEGER NOT NULL,
        thikr_id TEXT NOT NULL,
        current_count INTEGER NOT NULL DEFAULT 0,
        total_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(date, thikr_id)
      );`
    );

    // Create completed days table - session completion tracking
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${ATHKAR_COMPLETED_DAYS_TABLE} (
        date INTEGER PRIMARY KEY,
        morning_completed_at TEXT NULL,
        evening_completed_at TEXT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`
    );

    // Handle migration from old schema if needed
    await migrateCompletedDaysTable(db);

    // Create indexes for faster queries
    await db.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_daily_items_date
       ON ${ATHKAR_DAILY_ITEMS_TABLE}(date DESC);`
    );

    await db.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_daily_items_type
       ON ${ATHKAR_DAILY_ITEMS_TABLE}(date, thikr_id);`
    );

    await db.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_completed_days_date
       ON ${ATHKAR_COMPLETED_DAYS_TABLE}(date DESC);`
    );

    // Create audio downloads table
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${ATHKAR_AUDIO_DOWNLOADS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reciter_id TEXT NOT NULL,
        thikr_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        downloaded_at TEXT NOT NULL,
        UNIQUE(reciter_id, thikr_id)
      );`
    );

    await db.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_audio_downloads_reciter
       ON ${ATHKAR_AUDIO_DOWNLOADS_TABLE}(reciter_id);`
    );

    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${MY_ATHKAR_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_athkar_id INTEGER NOT NULL,
        source_category_id INTEGER NOT NULL,
        user_count INTEGER NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(source_athkar_id)
      );`
    );

    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${MY_ATHKAR_DAILY_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date INTEGER NOT NULL,
        my_athkar_id INTEGER NOT NULL,
        current_count INTEGER NOT NULL DEFAULT 0,
        total_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(date, my_athkar_id)
      );`
    );

    await db.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_my_athkar_daily_date
       ON ${MY_ATHKAR_DAILY_TABLE}(date);`
    );

    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${CUSTOM_ATHKAR_GROUPS_TABLE} (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        title      TEXT    NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT    NOT NULL
      );`
    );

    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${CUSTOM_ATHKAR_ITEMS_TABLE} (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id    INTEGER NOT NULL REFERENCES ${CUSTOM_ATHKAR_GROUPS_TABLE}(id),
        arabic_text TEXT    NOT NULL,
        user_count  INTEGER NOT NULL DEFAULT 1,
        sort_order  INTEGER NOT NULL,
        created_at  TEXT    NOT NULL
      );`
    );

    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${CUSTOM_ATHKAR_DAILY_TABLE} (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        date           INTEGER NOT NULL,
        custom_item_id INTEGER NOT NULL,
        current_count  INTEGER NOT NULL DEFAULT 0,
        total_count    INTEGER NOT NULL,
        created_at     TEXT    NOT NULL,
        updated_at     TEXT    NOT NULL,
        UNIQUE(date, custom_item_id)
      );`
    );

    await db.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_custom_athkar_daily_date
       ON ${CUSTOM_ATHKAR_DAILY_TABLE}(date);`
    );

    // Insert default streak entry if none exists
    const existingStreak = await db.getFirstAsync(
      `SELECT id FROM ${ATHKAR_STREAK_TABLE} WHERE id = 1;`
    );

    if (!existingStreak) {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO ${ATHKAR_STREAK_TABLE}
         (id, current_streak, longest_streak, last_streak_date, is_paused, tolerance_days, created_at, updated_at)
         VALUES (1, 0, 0, NULL, 0, 0, ?, ?);`,
        [now, now]
      );
    }
  } catch (error) {
    console.error("Error initializing athkar DB:", error);
    throw error;
  }
};

// Serialized single-connection wrapper. Every logical operation runs through
// sdb.run(db => ...) under a shared lock, so multi-statement operations are
// atomic against each other and only one physical connection ever touches the file.
const sdb = createSerializedDatabase(async () => {
  const db = await SQLite.openDatabaseAsync(
    ATHKAR_DB_NAME,
    { useNewConnection: true },
    await getDirectory()
  );
  await setupSchema(db);
  return db;
});

/** DAILY ITEMS OPERATIONS */

// Initialize all athkar items for a specific date. The guard + inserts run as
// a single exclusive transaction so a partial row set can never be observed as
// "already initialized"; the guard compares against the expected total so a
// day left partial by an earlier failure self-heals on the next call (the
// inserts are INSERT OR IGNORE so re-running back-fills the gaps).
const doInitializeDailyItems = async (
  db: SQLite.SQLiteDatabase,
  dateInt: number,
  morningList: { id: string; order: number; count: number; type: string }[],
  eveningList: { id: string; order: number; count: number; type: string }[]
): Promise<boolean> => {
  const tz = locationStore.getState().locationDetails.timezone;
  const now = timeZonedNow(tz).toISOString();
  const result = await initializeDailyItemsCore(db, dateInt, morningList, eveningList, now, log);

  // Dev-only tripwire: if a "successful" init left the row count short of the
  // expected total, the race-fix has regressed. Never runs in production
  // builds — see __DEV__ below.
  if (__DEV__ && result) {
    const expected = morningList.length + eveningList.length;
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${ATHKAR_DAILY_ITEMS_TABLE} WHERE date = ?;`,
      [dateInt]
    );
    const actual = row?.count ?? 0;
    if (actual < expected) {
      log.e(
        "DB",
        `[TRIPWIRE] initializeDailyItems regressed: date=${dateInt} expected>=${expected} got=${actual}`,
        new Error("daily-items post-condition violated")
      );
    }
  }

  return result;
};

// Dev-only verification probe for the race-fix. Uses a synthetic far-future
// date so it can't damage real user data. Seeds a partial 3-row set (the
// exact state the production bug left behind), invokes the public path the
// app uses, and reports whether the back-fill brought it to the expected
// total. Always cleans up its synthetic rows.
const verifyDailyInitRecovery = async (
  morningList: { id: string; order: number; count: number; type: string }[],
  eveningList: { id: string; order: number; count: number; type: string }[]
): Promise<{
  expected: number;
  seeded: number;
  afterInit: number;
  passed: boolean;
  message: string;
}> => {
  const PROBE_DATE = 99990101;
  const expected = morningList.length + eveningList.length;

  try {
    // Seed a partial set and count it — one serialized operation.
    const seeded = await sdb.run(async (db) => {
      const seedTs = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        await db.runAsync(`DELETE FROM ${ATHKAR_DAILY_ITEMS_TABLE} WHERE date = ?;`, [PROBE_DATE]);
        for (const id of ["1-evening", "2-evening", "3-evening"]) {
          await db.runAsync(
            `INSERT OR IGNORE INTO ${ATHKAR_DAILY_ITEMS_TABLE}
             (date, thikr_id, current_count, total_count, created_at, updated_at)
             VALUES (?, ?, 0, 1, ?, ?);`,
            [PROBE_DATE, id, seedTs, seedTs]
          );
        }
      });

      const seededRow = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${ATHKAR_DAILY_ITEMS_TABLE} WHERE date = ?;`,
        [PROBE_DATE]
      );
      return seededRow?.count ?? 0;
    });

    // Invoke the public path — it acquires the lock itself, so it must run
    // OUTSIDE the run() blocks (the lock is non-reentrant).
    const ok = await initializeDailyItems(PROBE_DATE, morningList, eveningList);

    // Count the result and clean up — one more serialized operation.
    const afterInit = await sdb.run(async (db) => {
      const afterRow = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${ATHKAR_DAILY_ITEMS_TABLE} WHERE date = ?;`,
        [PROBE_DATE]
      );
      const count = afterRow?.count ?? 0;

      // Clean up — never leave probe rows behind.
      await db.runAsync(`DELETE FROM ${ATHKAR_DAILY_ITEMS_TABLE} WHERE date = ?;`, [PROBE_DATE]);
      await db.runAsync(`DELETE FROM ${ATHKAR_COMPLETED_DAYS_TABLE} WHERE date = ?;`, [PROBE_DATE]);
      return count;
    });

    const passed = ok && afterInit >= expected;
    return {
      expected,
      seeded,
      afterInit,
      passed,
      message: passed
        ? `self-heal OK: ${seeded} → ${afterInit} (expected ≥ ${expected})`
        : `self-heal FAILED: ${seeded} → ${afterInit} (expected ≥ ${expected})`,
    };
  } catch (error) {
    // Best-effort cleanup before reporting.
    try {
      await sdb.run(async (db) => {
        await db.runAsync(`DELETE FROM ${ATHKAR_DAILY_ITEMS_TABLE} WHERE date = ?;`, [PROBE_DATE]);
        await db.runAsync(`DELETE FROM ${ATHKAR_COMPLETED_DAYS_TABLE} WHERE date = ?;`, [
          PROBE_DATE,
        ]);
      });
    } catch {
      /* ignore cleanup error so the original error is what surfaces */
    }
    return {
      expected,
      seeded: -1,
      afterInit: -1,
      passed: false,
      message: `error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// Public entry point: serializes every call through the shared lock so
// concurrent invocations execute sequentially instead of colliding on the
// shared connection's transaction.
const initializeDailyItems = (
  dateInt: number,
  morningList: { id: string; order: number; count: number; type: string }[],
  eveningList: { id: string; order: number; count: number; type: string }[]
): Promise<boolean> =>
  sdb.run((db) => doInitializeDailyItems(db, dateInt, morningList, eveningList));

// Get all morning or evening items for a specific date. Takes db so it can be
// reused inside another run() callback (e.g. checkAndMarkSessionComplete)
// without nesting run() and deadlocking the non-reentrant lock.
const getSessionItemsWith = async (
  db: SQLite.SQLiteDatabase,
  dateInt: number,
  session: "morning" | "evening"
): Promise<AthkarDailyItem[]> => {
  try {
    const results = await db.getAllAsync(
      `SELECT * FROM ${ATHKAR_DAILY_ITEMS_TABLE}
       WHERE date = ? AND thikr_id LIKE ?
       ORDER BY thikr_id;`,
      [dateInt, `%-${session}`]
    );

    if (!results) return [];

    const parsed = results.map((r) => {
      try {
        return AthkarDailyItemSchema.parse(r);
      } catch (err) {
        log.w("DB", `getSessionItems: Zod rejected row ${JSON.stringify(r)} — ${err}`);
        return null;
      }
    });

    const valid = parsed.filter((item): item is AthkarDailyItem => item !== null);
    const dropped = results.length - valid.length;
    if (dropped > 0) {
      log.w(
        "DB",
        `getSessionItems: date=${dateInt} session=${session} — ${dropped}/${results.length} rows dropped by Zod`
      );
    }

    return valid;
  } catch (error) {
    log.e(
      "DB",
      "getSessionItems failed",
      error instanceof Error ? error : new Error(String(error))
    );
    return [];
  }
};

const getSessionItems = (
  dateInt: number,
  session: "morning" | "evening"
): Promise<AthkarDailyItem[]> => sdb.run((db) => getSessionItemsWith(db, dateInt, session));

// Update a single athkar item count
const updateAthkarCount = (
  dateInt: number,
  thikrId: string,
  currentCount: number
): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const tz = locationStore.getState().locationDetails.timezone;
      const now = timeZonedNow(tz).toISOString();

      const result = await db.runAsync(
        `UPDATE ${ATHKAR_DAILY_ITEMS_TABLE}
         SET current_count = ?, updated_at = ?
         WHERE date = ? AND thikr_id = ?;`,
        [currentCount, now, dateInt, thikrId]
      );

      if (result.changes === 0) {
        log.w(
          "DB",
          `updateAthkarCount: 0 rows changed for thikrId=${thikrId} date=${dateInt} count=${currentCount} — row may not exist`
        );
      }

      return result.changes > 0;
    } catch (error) {
      log.e(
        "DB",
        "updateAthkarCount failed",
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  });

// Reset all counts for a specific session (morning/evening)
const resetSessionCounts = (dateInt: number, session: "morning" | "evening"): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const tz = locationStore.getState().locationDetails.timezone;
      const now = timeZonedNow(tz).toISOString();

      await db.runAsync(
        `UPDATE ${ATHKAR_DAILY_ITEMS_TABLE}
         SET current_count = 0, updated_at = ?
         WHERE date = ? AND thikr_id LIKE ?;`,
        [now, dateInt, `%-${session}`]
      );

      // Also reset completion status
      const columnName = session === "morning" ? "morning_completed_at" : "evening_completed_at";
      await db.runAsync(
        `UPDATE ${ATHKAR_COMPLETED_DAYS_TABLE}
         SET ${columnName} = NULL, updated_at = ?
         WHERE date = ?;`,
        [now, dateInt]
      );

      return true;
    } catch (error) {
      console.error("Error resetting session counts:", error);
      return false;
    }
  });

// Check if a session is completed and mark it
const checkAndMarkSessionComplete = (
  dateInt: number,
  session: "morning" | "evening"
): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      // Get all items for this session (use the helper with the same db so we
      // don't nest run() — the lock is non-reentrant).
      const items = await getSessionItemsWith(db, dateInt, session);

      // Check if all items are completed (current_count >= total_count)
      const allCompleted =
        items.length > 0 && items.every((item) => item.current_count >= item.total_count);

      if (allCompleted) {
        const tz = locationStore.getState().locationDetails.timezone;
        const now = timeZonedNow(tz).toISOString();
        const columnName = session === "morning" ? "morning_completed_at" : "evening_completed_at";

        // Check if already marked as completed
        const completedDay = await db.getFirstAsync(
          `SELECT ${columnName} FROM ${ATHKAR_COMPLETED_DAYS_TABLE} WHERE date = ?;`,
          [dateInt]
        );

        if (completedDay && (completedDay as any)[columnName] === null) {
          // Mark as completed
          await db.runAsync(
            `UPDATE ${ATHKAR_COMPLETED_DAYS_TABLE}
             SET ${columnName} = ?, updated_at = ?
             WHERE date = ?;`,
            [now, now, dateInt]
          );
        }
      }

      return allCompleted;
    } catch (error) {
      console.error("Error checking session completion:", error);
      return false;
    }
  });

// Check if morning/evening is completed for a day
const isSessionCompleted = (dateInt: number, session: "morning" | "evening"): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const columnName = session === "morning" ? "morning_completed_at" : "evening_completed_at";
      const result: any = await db.getFirstAsync(
        `SELECT ${columnName} FROM ${ATHKAR_COMPLETED_DAYS_TABLE} WHERE date = ?;`,
        [dateInt]
      );

      return result && result[columnName] !== null;
    } catch (error) {
      console.error("Error checking session completion:", error);
      return false;
    }
  });

// Check if both sessions are completed for streak calculation
const areBothSessionsCompleted = (dateInt: number): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const result = await db.getFirstAsync(
        `SELECT morning_completed_at, evening_completed_at
         FROM ${ATHKAR_COMPLETED_DAYS_TABLE}
         WHERE date = ?;`,
        [dateInt]
      );

      if (!result) return false;

      const completedDay = result as any;
      return (
        completedDay.morning_completed_at !== null && completedDay.evening_completed_at !== null
      );
    } catch (error) {
      console.error("Error checking both sessions completion:", error);
      return false;
    }
  });

// Update total counts for existing items (used when shortVersion changes)
const updateTotalCounts = (
  dateInt: number,
  morningList: { order: number; count: number }[],
  eveningList: { order: number; count: number }[]
): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const tz = locationStore.getState().locationDetails.timezone;
      const now = timeZonedNow(tz).toISOString();

      console.log(
        `[Athkar-DB] Updating total counts for date ${dateInt} - Morning: ${morningList.length}, Evening: ${eveningList.length}`
      );

      await db.withTransactionAsync(async () => {
        // Update morning items
        for (const athkar of morningList) {
          const thikrId = `${athkar.order}-morning`;
          await db.runAsync(
            `UPDATE ${ATHKAR_DAILY_ITEMS_TABLE}
             SET total_count = ?, updated_at = ?
             WHERE date = ? AND thikr_id = ?;`,
            [athkar.count, now, dateInt, thikrId]
          );
        }

        // Update evening items
        for (const athkar of eveningList) {
          const thikrId = `${athkar.order}-evening`;
          await db.runAsync(
            `UPDATE ${ATHKAR_DAILY_ITEMS_TABLE}
             SET total_count = ?, updated_at = ?
             WHERE date = ? AND thikr_id = ?;`,
            [athkar.count, now, dateInt, thikrId]
          );
        }
      });

      console.log(
        `[Athkar-DB] Successfully updated total counts for ${morningList.length} morning and ${eveningList.length} evening athkar`
      );
      return true;
    } catch (error) {
      console.error("Error updating total counts:", error);
      return false;
    }
  });

const cleanOldData = (daysToKeep: number = 5): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const tz = locationStore.getState().locationDetails.timezone;
      const cutoffDate = timeZonedNow(tz);
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateInt = dateToInt(cutoffDate);

      await db.withTransactionAsync(async () => {
        // Clean daily items
        await db.runAsync(`DELETE FROM ${ATHKAR_DAILY_ITEMS_TABLE} WHERE date < ?;`, [
          cutoffDateInt,
        ]);

        // Clean completed days
        await db.runAsync(`DELETE FROM ${ATHKAR_COMPLETED_DAYS_TABLE} WHERE date < ?;`, [
          cutoffDateInt,
        ]);
      });

      console.log(`[Athkar-DB] Cleaned data older than ${cutoffDate.toDateString()}`);
      return true;
    } catch (error) {
      console.error("Error cleaning old data:", error);
      return false;
    }
  });

/** STREAK OPERATIONS */

const getStreakData = (): Promise<AthkarStreak | null> =>
  sdb.run(async (db) => {
    try {
      const result = await db.getFirstAsync(`SELECT * FROM ${ATHKAR_STREAK_TABLE} WHERE id = 1;`);

      if (!result) return null;

      return AthkarStreakSchema.parse(result);
    } catch (error) {
      console.error("Error getting streak data:", error);
      return null;
    }
  });

// Update streak when both sessions are completed
const updateStreakForDay = (
  dateInt: number
): Promise<{
  success: boolean;
  currentStreak: number;
  longestStreak: number;
  alreadyCompleted?: boolean;
} | null> =>
  sdb.run(async (db) => {
    try {
      let result = null;

      await db.withTransactionAsync(async () => {
        // Check if both sessions are completed (use db directly to avoid reentrant openDatabase call)
        const completionResult = await db.getFirstAsync(
          `SELECT morning_completed_at, evening_completed_at
           FROM ${ATHKAR_COMPLETED_DAYS_TABLE}
           WHERE date = ?;`,
          [dateInt]
        );
        const bothCompleted =
          completionResult &&
          (completionResult as any).morning_completed_at !== null &&
          (completionResult as any).evening_completed_at !== null;

        if (!bothCompleted) {
          result = { success: false, currentStreak: 0, longestStreak: 0 };
          return;
        }

        // Get current streak data (use db directly to avoid reentrant openDatabase call)
        const streakResult = await db.getFirstAsync(
          `SELECT * FROM ${ATHKAR_STREAK_TABLE} WHERE id = 1;`
        );
        const streakData = streakResult ? AthkarStreakSchema.parse(streakResult) : null;
        if (!streakData) throw new Error("No streak data found");

        // Determine new streak values
        let newCurrentStreak = 1;
        let shouldUpdate = false;

        if (!streakData.last_streak_date) {
          // First ever completion
          shouldUpdate = true;
        } else {
          const daysSinceLastStreak = dateInt - streakData.last_streak_date;

          if (daysSinceLastStreak === 1) {
            // Consecutive day
            newCurrentStreak = streakData.current_streak + 1;
            shouldUpdate = true;
          } else if (daysSinceLastStreak === 0) {
            // Same day - already completed
            result = {
              success: true,
              currentStreak: streakData.current_streak,
              longestStreak: streakData.longest_streak,
              alreadyCompleted: true,
            };
            return;
          } else if (
            streakData.tolerance_days > 0 &&
            daysSinceLastStreak <= streakData.tolerance_days + 1 &&
            !streakData.is_paused
          ) {
            // Within tolerance
            newCurrentStreak = streakData.current_streak + 1;
            shouldUpdate = true;
          } else {
            // Streak broken - reset to 1
            newCurrentStreak = 1;
            shouldUpdate = true;
          }
        }

        if (shouldUpdate) {
          const newLongestStreak = Math.max(newCurrentStreak, streakData.longest_streak);
          const now = new Date().toISOString();

          await db.runAsync(
            `UPDATE ${ATHKAR_STREAK_TABLE}
             SET current_streak = ?,
                 longest_streak = ?,
                 last_streak_date = ?,
                 updated_at = ?
             WHERE id = 1;`,
            [newCurrentStreak, newLongestStreak, dateInt, now]
          );

          result = {
            success: true,
            currentStreak: newCurrentStreak,
            longestStreak: newLongestStreak,
            alreadyCompleted: false,
          };
        }
      });

      return result;
    } catch (error) {
      console.error("Error updating streak for day:", error);
      return null;
    }
  });

// Reset current streak
const resetCurrentStreak = (): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      await db.runAsync(
        `UPDATE ${ATHKAR_STREAK_TABLE}
         SET current_streak = 0,
             last_streak_date = NULL,
             updated_at = ?
         WHERE id = 1;`,
        [new Date().toISOString()]
      );

      return true;
    } catch (error) {
      console.error("Error resetting streak:", error);
      return false;
    }
  });

// Update streak settings
const updateStreakSettings = (settings: {
  isPaused?: boolean;
  toleranceDays?: number;
}): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (settings.isPaused !== undefined) {
        updates.push("is_paused = ?");
        values.push(settings.isPaused ? 1 : 0);
      }

      if (settings.toleranceDays !== undefined) {
        updates.push("tolerance_days = ?");
        values.push(settings.toleranceDays);
      }

      if (updates.length === 0) return true;

      updates.push("updated_at = ?");
      values.push(new Date().toISOString());

      await db.runAsync(
        `UPDATE ${ATHKAR_STREAK_TABLE}
         SET ${updates.join(", ")}
         WHERE id = 1;`,
        values
      );

      return true;
    } catch (error) {
      console.error("Error updating streak settings:", error);
      return false;
    }
  });

// Validate streak by checking for missed days between last completed and today
const validateStreakForToday = (
  todayInt: number
): Promise<{
  success: boolean;
  streakBroken: boolean;
  currentStreak: number;
  longestStreak: number;
} | null> =>
  sdb.run(async (db) => {
    try {
      let result = null;

      await db.withTransactionAsync(async () => {
        // Get current streak data (use db directly to avoid reentrant openDatabase call)
        const streakResult = await db.getFirstAsync(
          `SELECT * FROM ${ATHKAR_STREAK_TABLE} WHERE id = 1;`
        );
        const streakData = streakResult ? AthkarStreakSchema.parse(streakResult) : null;
        if (!streakData) throw new Error("No streak data found");

        // If no previous streak or paused, nothing to validate
        if (!streakData.last_streak_date || streakData.is_paused) {
          result = {
            success: true,
            streakBroken: false,
            currentStreak: streakData.current_streak,
            longestStreak: streakData.longest_streak,
          };
          return;
        }

        const daysSinceLastStreak = todayInt - streakData.last_streak_date;

        // If it's the same day or consecutive day, no action needed
        if (daysSinceLastStreak <= 1) {
          result = {
            success: true,
            streakBroken: false,
            currentStreak: streakData.current_streak,
            longestStreak: streakData.longest_streak,
          };
          return;
        }

        // Check if gap is within tolerance
        const withinTolerance =
          streakData.tolerance_days > 0 && daysSinceLastStreak <= streakData.tolerance_days + 1;

        if (!withinTolerance) {
          // Streak is broken - reset to 0
          const tz = locationStore.getState().locationDetails.timezone;
          const now = timeZonedNow(tz).toISOString();

          await db.runAsync(
            `UPDATE ${ATHKAR_STREAK_TABLE}
             SET current_streak = 0,
                 updated_at = ?
             WHERE id = 1;`,
            [now]
          );

          result = {
            success: true,
            streakBroken: true,
            currentStreak: 0,
            longestStreak: streakData.longest_streak,
          };
        } else {
          // Within tolerance, keep current streak
          result = {
            success: true,
            streakBroken: false,
            currentStreak: streakData.current_streak,
            longestStreak: streakData.longest_streak,
          };
        }
      });

      return result;
    } catch (error) {
      console.error("Error validating streak for today:", error);
      return null;
    }
  });

/** AUDIO DOWNLOAD OPERATIONS */

const insertAudioDownload = (
  reciterId: string,
  thikrId: string,
  filePath: string,
  fileSize: number
): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT OR REPLACE INTO ${ATHKAR_AUDIO_DOWNLOADS_TABLE}
         (reciter_id, thikr_id, file_path, file_size, downloaded_at)
         VALUES (?, ?, ?, ?, ?);`,
        [reciterId, thikrId, filePath, fileSize, now]
      );
      return true;
    } catch (error) {
      console.error("[Athkar-DB] Error inserting audio download:", error);
      return false;
    }
  });

const getAudioDownload = (
  reciterId: string,
  thikrId: string
): Promise<AthkarAudioDownload | null> =>
  sdb.run(async (db) => {
    try {
      const result = await db.getFirstAsync(
        `SELECT * FROM ${ATHKAR_AUDIO_DOWNLOADS_TABLE}
         WHERE reciter_id = ? AND thikr_id = ?;`,
        [reciterId, thikrId]
      );

      if (!result) return null;
      return AthkarAudioDownloadSchema.parse(result);
    } catch (error) {
      console.error("[Athkar-DB] Error getting audio download:", error);
      return null;
    }
  });

const getReciterDownloads = (reciterId: string): Promise<AthkarAudioDownload[]> =>
  sdb.run(async (db) => {
    try {
      const results = await db.getAllAsync(
        `SELECT * FROM ${ATHKAR_AUDIO_DOWNLOADS_TABLE}
         WHERE reciter_id = ?
         ORDER BY thikr_id;`,
        [reciterId]
      );

      if (!results) return [];

      return results
        .map((r) => {
          try {
            return AthkarAudioDownloadSchema.parse(r);
          } catch {
            return null;
          }
        })
        .filter((item): item is AthkarAudioDownload => item !== null);
    } catch (error) {
      log.e("DB", "getReciterDownloads failed", error instanceof Error ? error : undefined);
      return [];
    }
  });

const deleteReciterDownloads = (reciterId: string): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      await db.runAsync(`DELETE FROM ${ATHKAR_AUDIO_DOWNLOADS_TABLE} WHERE reciter_id = ?;`, [
        reciterId,
      ]);
      return true;
    } catch (error) {
      console.error("[Athkar-DB] Error deleting reciter downloads:", error);
      return false;
    }
  });

const deleteAudioDownload = (reciterId: string, thikrId: string): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      await db.runAsync(
        `DELETE FROM ${ATHKAR_AUDIO_DOWNLOADS_TABLE} WHERE reciter_id = ? AND thikr_id = ?;`,
        [reciterId, thikrId]
      );
      return true;
    } catch (error) {
      console.error("[Athkar-DB] Error deleting audio download:", error);
      return false;
    }
  });

const getAudioStorageUsed = (reciterId?: string): Promise<number> =>
  sdb.run(async (db) => {
    try {
      const query = reciterId
        ? `SELECT COALESCE(SUM(file_size), 0) as total FROM ${ATHKAR_AUDIO_DOWNLOADS_TABLE} WHERE reciter_id = ?;`
        : `SELECT COALESCE(SUM(file_size), 0) as total FROM ${ATHKAR_AUDIO_DOWNLOADS_TABLE};`;

      const params = reciterId ? [reciterId] : [];
      const result: any = await db.getFirstAsync(query, params);

      return result?.total ?? 0;
    } catch (error) {
      console.error("[Athkar-DB] Error getting audio storage used:", error);
      return 0;
    }
  });

const isThikrDownloaded = (reciterId: string, thikrId: string): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const result = await db.getFirstAsync(
        `SELECT id FROM ${ATHKAR_AUDIO_DOWNLOADS_TABLE}
         WHERE reciter_id = ? AND thikr_id = ?;`,
        [reciterId, thikrId]
      );
      return result !== null;
    } catch (error) {
      console.error("[Athkar-DB] Error checking thikr download:", error);
      return false;
    }
  });

/** MY ATHKAR OPERATIONS */

const getMyAthkar = (): Promise<
  {
    id: number;
    source_athkar_id: number;
    source_category_id: number;
    user_count: number;
    sort_order: number;
  }[]
> => sdb.run((db) => db.getAllAsync(`SELECT * FROM ${MY_ATHKAR_TABLE} ORDER BY sort_order ASC`));

const addToMyAthkar = (
  sourceAthkarId: number,
  sourceCategoryId: number,
  userCount: number
): Promise<number | null> =>
  sdb.run(async (db) => {
    try {
      const tz = locationStore.getState().locationDetails.timezone;
      const now = timeZonedNow(tz).toISOString();

      const last = await db.getFirstAsync<{ max_order: number | null }>(
        `SELECT MAX(sort_order) as max_order FROM ${MY_ATHKAR_TABLE}`
      );
      const nextOrder = (last?.max_order ?? 0) + 1;

      const result = await db.runAsync(
        `INSERT OR IGNORE INTO ${MY_ATHKAR_TABLE}
         (source_athkar_id, source_category_id, user_count, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [sourceAthkarId, sourceCategoryId, userCount, nextOrder, now]
      );

      return result.changes > 0 ? result.lastInsertRowId : null;
    } catch (error) {
      console.error("[Athkar-DB] Error adding to my athkar:", error);
      return null;
    }
  });

const batchAddToMyAthkar = (
  items: { sourceAthkarId: number; sourceCategoryId: number; userCount: number }[]
): Promise<number[]> => {
  if (items.length === 0) return Promise.resolve([]);

  return sdb.run(async (db) => {
    try {
      const tz = locationStore.getState().locationDetails.timezone;
      const now = timeZonedNow(tz).toISOString();
      const insertedIds: number[] = [];

      await db.withTransactionAsync(async () => {
        const last = await db.getFirstAsync<{ max_order: number | null }>(
          `SELECT MAX(sort_order) as max_order FROM ${MY_ATHKAR_TABLE}`
        );
        let nextOrder = (last?.max_order ?? 0) + 1;

        for (const item of items) {
          const result = await db.runAsync(
            `INSERT OR IGNORE INTO ${MY_ATHKAR_TABLE}
             (source_athkar_id, source_category_id, user_count, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [item.sourceAthkarId, item.sourceCategoryId, item.userCount, nextOrder, now]
          );
          if (result.changes > 0) {
            insertedIds.push(result.lastInsertRowId);
            nextOrder++;
          }
        }
      });

      return insertedIds;
    } catch (error) {
      log.e("DB", "batch add to my athkar failed", error instanceof Error ? error : undefined);
      return [];
    }
  });
};

const removeFromMyAthkar = (id: number): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      await db.runAsync(`DELETE FROM ${MY_ATHKAR_TABLE} WHERE id = ?`, [id]);
      await db.runAsync(`DELETE FROM ${MY_ATHKAR_DAILY_TABLE} WHERE my_athkar_id = ?`, [id]);
      return true;
    } catch (error) {
      console.error("[Athkar-DB] Error removing from my athkar:", error);
      return false;
    }
  });

const updateMyAthkarUserCount = (id: number, userCount: number): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const result = await db.runAsync(
        `UPDATE ${MY_ATHKAR_TABLE} SET user_count = ? WHERE id = ?`,
        [userCount, id]
      );
      return result.changes > 0;
    } catch (error) {
      console.error("[Athkar-DB] Error updating my athkar count:", error);
      return false;
    }
  });

/** MY ATHKAR DAILY OPERATIONS */

const initializeMyAthkarDaily = (
  dateInt: number,
  items: { id: number; userCount: number }[]
): Promise<boolean> => {
  if (items.length === 0) return Promise.resolve(true);

  return sdb.run(async (db) => {
    try {
      const tz = locationStore.getState().locationDetails.timezone;
      const now = timeZonedNow(tz).toISOString();

      await db.withTransactionAsync(async () => {
        for (const item of items) {
          await db.runAsync(
            `INSERT OR IGNORE INTO ${MY_ATHKAR_DAILY_TABLE}
             (date, my_athkar_id, current_count, total_count, created_at, updated_at)
             VALUES (?, ?, 0, ?, ?, ?)`,
            [dateInt, item.id, item.userCount, now, now]
          );
        }
      });

      return true;
    } catch (error) {
      console.error("[Athkar-DB] Error initializing my athkar daily:", error);
      return false;
    }
  });
};

const getMyAthkarDailyProgress = (
  dateInt: number
): Promise<{ my_athkar_id: number; current_count: number; total_count: number }[]> =>
  sdb.run((db) =>
    db.getAllAsync(
      `SELECT my_athkar_id, current_count, total_count
       FROM ${MY_ATHKAR_DAILY_TABLE}
       WHERE date = ?`,
      [dateInt]
    )
  );

const updateMyAthkarDailyCount = (
  dateInt: number,
  myAthkarId: number,
  currentCount: number
): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const tz = locationStore.getState().locationDetails.timezone;
      const now = timeZonedNow(tz).toISOString();

      const result = await db.runAsync(
        `UPDATE ${MY_ATHKAR_DAILY_TABLE}
         SET current_count = ?, updated_at = ?
         WHERE date = ? AND my_athkar_id = ?`,
        [currentCount, now, dateInt, myAthkarId]
      );
      return result.changes > 0;
    } catch (error) {
      console.error("[Athkar-DB] Error updating my athkar daily count:", error);
      return false;
    }
  });

const resetMyAthkarDaily = (dateInt: number): Promise<boolean> =>
  sdb.run(async (db) => {
    try {
      const tz = locationStore.getState().locationDetails.timezone;
      const now = timeZonedNow(tz).toISOString();

      await db.runAsync(
        `UPDATE ${MY_ATHKAR_DAILY_TABLE}
         SET current_count = 0, updated_at = ?
         WHERE date = ?`,
        [now, dateInt]
      );
      return true;
    } catch (error) {
      console.error("[Athkar-DB] Error resetting my athkar daily:", error);
      return false;
    }
  });

export const AthkarDB = {
  run: sdb.run,
  initialize: () => sdb.run(async () => {}),

  // Daily items operations
  initializeDailyItems,
  verifyDailyInitRecovery,
  updateTotalCounts,
  getSessionItems,
  updateAthkarCount,
  resetSessionCounts,
  checkAndMarkSessionComplete,
  isSessionCompleted,
  areBothSessionsCompleted,

  // Streak operations
  getStreakData,
  updateStreakForDay,
  resetCurrentStreak,
  updateStreakSettings,
  validateStreakForToday,

  // Audio downloads
  insertAudioDownload,
  getAudioDownload,
  getReciterDownloads,
  deleteAudioDownload,
  deleteReciterDownloads,
  getAudioStorageUsed,
  isThikrDownloaded,

  // Utility
  cleanOldData,

  // My Athkar
  getMyAthkar,
  addToMyAthkar,
  batchAddToMyAthkar,
  removeFromMyAthkar,
  updateMyAthkarUserCount,
  initializeMyAthkarDaily,
  getMyAthkarDailyProgress,
  updateMyAthkarDailyCount,
  resetMyAthkarDaily,

  // Custom Athkar
  createCustomAthkarGroup: (
    title: string,
    items: { arabicText: string; userCount: number }[]
  ): Promise<number | null> =>
    sdb.run(async (db) => {
      const now = new Date().toISOString();
      try {
        let groupId: number | null = null;
        await db.withTransactionAsync(async () => {
          const countResult = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM ${CUSTOM_ATHKAR_GROUPS_TABLE}`
          );
          const nextGroupOrder = (countResult?.count ?? 0) + 1;
          const groupResult = await db.runAsync(
            `INSERT INTO ${CUSTOM_ATHKAR_GROUPS_TABLE} (title, sort_order, created_at) VALUES (?, ?, ?)`,
            [title, nextGroupOrder, now]
          );
          groupId = groupResult.lastInsertRowId;
          for (let i = 0; i < items.length; i++) {
            await db.runAsync(
              `INSERT INTO ${CUSTOM_ATHKAR_ITEMS_TABLE} (group_id, arabic_text, user_count, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`,
              [groupId, items[i].arabicText, items[i].userCount, i + 1, now]
            );
          }
        });
        return groupId;
      } catch (error) {
        console.error("[Athkar-DB] createCustomAthkarGroup error:", error);
        return null;
      }
    }),

  updateCustomAthkarGroup: (
    groupId: number,
    title: string,
    items: { arabicText: string; userCount: number }[]
  ): Promise<boolean> =>
    sdb.run(async (db) => {
      const now = new Date().toISOString();
      try {
        await db.withTransactionAsync(async () => {
          await db.runAsync(`UPDATE ${CUSTOM_ATHKAR_GROUPS_TABLE} SET title = ? WHERE id = ?`, [
            title,
            groupId,
          ]);
          const oldItems = await db.getAllAsync<{ id: number }>(
            `SELECT id FROM ${CUSTOM_ATHKAR_ITEMS_TABLE} WHERE group_id = ?`,
            [groupId]
          );
          for (const item of oldItems) {
            await db.runAsync(`DELETE FROM ${CUSTOM_ATHKAR_DAILY_TABLE} WHERE custom_item_id = ?`, [
              item.id,
            ]);
          }
          await db.runAsync(`DELETE FROM ${CUSTOM_ATHKAR_ITEMS_TABLE} WHERE group_id = ?`, [
            groupId,
          ]);
          for (let i = 0; i < items.length; i++) {
            await db.runAsync(
              `INSERT INTO ${CUSTOM_ATHKAR_ITEMS_TABLE} (group_id, arabic_text, user_count, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`,
              [groupId, items[i].arabicText, items[i].userCount, i + 1, now]
            );
          }
        });
        return true;
      } catch (error) {
        console.error("[Athkar-DB] updateCustomAthkarGroup error:", error);
        return false;
      }
    }),

  deleteCustomAthkarGroup: (groupId: number): Promise<void> =>
    sdb.run(async (db) => {
      try {
        await db.withTransactionAsync(async () => {
          const items = await db.getAllAsync<{ id: number }>(
            `SELECT id FROM ${CUSTOM_ATHKAR_ITEMS_TABLE} WHERE group_id = ?`,
            [groupId]
          );
          for (const item of items) {
            await db.runAsync(`DELETE FROM ${CUSTOM_ATHKAR_DAILY_TABLE} WHERE custom_item_id = ?`, [
              item.id,
            ]);
          }
          await db.runAsync(`DELETE FROM ${CUSTOM_ATHKAR_ITEMS_TABLE} WHERE group_id = ?`, [
            groupId,
          ]);
          await db.runAsync(`DELETE FROM ${CUSTOM_ATHKAR_GROUPS_TABLE} WHERE id = ?`, [groupId]);
        });
      } catch (error) {
        console.error("[Athkar-DB] deleteCustomAthkarGroup error:", error);
      }
    }),

  getCustomAthkarGroups: (): Promise<
    { id: number; title: string; sort_order: number; created_at: string }[]
  > =>
    sdb.run((db) =>
      db.getAllAsync(
        `SELECT id, title, sort_order, created_at FROM ${CUSTOM_ATHKAR_GROUPS_TABLE} ORDER BY sort_order ASC`
      )
    ),

  getCustomAthkarItems: (): Promise<
    {
      id: number;
      group_id: number;
      arabic_text: string;
      user_count: number;
      sort_order: number;
    }[]
  > =>
    sdb.run((db) =>
      db.getAllAsync(
        `SELECT id, group_id, arabic_text, user_count, sort_order FROM ${CUSTOM_ATHKAR_ITEMS_TABLE} ORDER BY group_id ASC, sort_order ASC`
      )
    ),

  initializeCustomAthkarDaily: (
    dateInt: number,
    items: { id: number; userCount: number }[]
  ): Promise<void> =>
    sdb.run(async (db) => {
      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        for (const item of items) {
          await db.runAsync(
            `INSERT OR IGNORE INTO ${CUSTOM_ATHKAR_DAILY_TABLE}
             (date, custom_item_id, current_count, total_count, created_at, updated_at)
             VALUES (?, ?, 0, ?, ?, ?)`,
            [dateInt, item.id, item.userCount, now, now]
          );
        }
      });
    }),

  getCustomAthkarDailyProgress: (
    dateInt: number
  ): Promise<{ custom_item_id: number; current_count: number; total_count: number }[]> =>
    sdb.run((db) =>
      db.getAllAsync(
        `SELECT custom_item_id, current_count, total_count
         FROM ${CUSTOM_ATHKAR_DAILY_TABLE}
         WHERE date = ?`,
        [dateInt]
      )
    ),

  updateCustomAthkarDailyCount: (
    dateInt: number,
    customItemId: number,
    currentCount: number
  ): Promise<void> =>
    sdb.run(async (db) => {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE ${CUSTOM_ATHKAR_DAILY_TABLE}
         SET current_count = ?, updated_at = ?
         WHERE date = ? AND custom_item_id = ?`,
        [currentCount, now, dateInt, customItemId]
      );
    }),
};
