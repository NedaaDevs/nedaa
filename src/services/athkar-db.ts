import * as SQLite from "expo-sqlite";
import { z } from "zod";

// Services
import { getDirectory } from "@/services/db";

// Utils
import { dateToInt, timeZonedNow } from "@/utils/date";

// Constants
import {
  ATHKAR_STREAK_TABLE,
  ATHKAR_COMPLETED_DAYS_TABLE,
  ATHKAR_DAILY_ITEMS_TABLE,
  ATHKAR_DB_NAME,
} from "@/constants/DB";

// Stores
import locationStore from "@/stores/location";

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

type AthkarStreak = z.infer<typeof AthkarStreakSchema>;
type AthkarDailyItem = z.infer<typeof AthkarDailyItemSchema>;

// Open Database
const openDatabase = async () =>
  await SQLite.openDatabaseAsync(
    ATHKAR_DB_NAME,
    {
      useNewConnection: true,
      enableChangeListener: false,
    },
    await getDirectory()
  );

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

const initializeDB = async () => {
  const db = await openDatabase();

  try {
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

/** DAILY ITEMS OPERATIONS */

// Initialize all athkar items for a specific date (batch insert)
const initializeDailyItems = async (
  dateInt: number,
  athkarList: { order: number; count: number }[]
): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const tz = locationStore.getState().locationDetails.timezone;
    const now = timeZonedNow(tz).toISOString();

    // Check if already initialized by checking if ANY items exist for this date
    const existingItems = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM ${ATHKAR_DAILY_ITEMS_TABLE} WHERE date = ?;`,
      [dateInt]
    );

    if (existingItems && (existingItems as any).count > 0) {
      console.log(`[Athkar-DB] Daily items already initialized for date ${dateInt} skipping...`);
      return true; // Already initialized
    }

    console.log(
      `[Athkar-DB] Initializing daily items for date ${dateInt} with ${athkarList.length} athkar types`
    );

    await db.withTransactionAsync(async () => {
      // Insert all items for both morning and evening
      for (const athkar of athkarList) {
        const morningThikrId = `${athkar.order}-morning`;
        const eveningThikrId = `${athkar.order}-evening`;

        // Use INSERT OR IGNORE to prevent duplicate key errors
        await db.runAsync(
          `INSERT OR IGNORE INTO ${ATHKAR_DAILY_ITEMS_TABLE} 
           (date, thikr_id, current_count, total_count, created_at, updated_at)
           VALUES (?, ?, 0, ?, ?, ?);`,
          [dateInt, morningThikrId, athkar.count, now, now]
        );

        await db.runAsync(
          `INSERT OR IGNORE INTO ${ATHKAR_DAILY_ITEMS_TABLE} 
           (date, thikr_id, current_count, total_count, created_at, updated_at)
           VALUES (?, ?, 0, ?, ?, ?);`,
          [dateInt, eveningThikrId, athkar.count, now, now]
        );
      }

      // Initialize completed_days entry (also use INSERT OR IGNORE)
      await db.runAsync(
        `INSERT OR IGNORE INTO ${ATHKAR_COMPLETED_DAYS_TABLE} 
         (date, morning_completed_at, evening_completed_at, created_at, updated_at)
         VALUES (?, NULL, NULL, ?, ?);`,
        [dateInt, now, now]
      );
    });

    console.log(
      `[Athkar-DB] Successfully initialized ${athkarList.length * 2} daily items for date ${dateInt}`
    );
    return true;
  } catch (error) {
    console.error("Error initializing daily items:", error);
    return false;
  }
};

// Get all morning or evening items for a specific date
const getSessionItems = async (
  dateInt: number,
  session: "morning" | "evening"
): Promise<AthkarDailyItem[]> => {
  const db = await openDatabase();

  try {
    const results = await db.getAllAsync(
      `SELECT * FROM ${ATHKAR_DAILY_ITEMS_TABLE} 
       WHERE date = ? AND thikr_id LIKE ?
       ORDER BY thikr_id;`,
      [dateInt, `%-${session}`]
    );

    if (!results) return [];

    return results
      .map((r) => {
        try {
          return AthkarDailyItemSchema.parse(r);
        } catch {
          return null;
        }
      })
      .filter((item): item is AthkarDailyItem => item !== null);
  } catch (error) {
    console.error("Error getting session items:", error);
    return [];
  }
};

// Update a single athkar item count
const updateAthkarCount = async (
  dateInt: number,
  thikrId: string,
  currentCount: number
): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const tz = locationStore.getState().locationDetails.timezone;
    const now = timeZonedNow(tz).toISOString();

    const result = await db.runAsync(
      `UPDATE ${ATHKAR_DAILY_ITEMS_TABLE} 
       SET current_count = ?, updated_at = ?
       WHERE date = ? AND thikr_id = ?;`,
      [currentCount, now, dateInt, thikrId]
    );

    return result.changes > 0;
  } catch (error) {
    console.error("Error updating athkar count:", error);
    return false;
  }
};

// Reset all counts for a specific session (morning/evening)
const resetSessionCounts = async (
  dateInt: number,
  session: "morning" | "evening"
): Promise<boolean> => {
  const db = await openDatabase();

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
};

// Check if a session is completed and mark it
const checkAndMarkSessionComplete = async (
  dateInt: number,
  session: "morning" | "evening"
): Promise<boolean> => {
  const db = await openDatabase();

  try {
    // Get all items for this session
    const items = await getSessionItems(dateInt, session);

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
};

// Check if morning/evening is completed for a day
const isSessionCompleted = async (
  dateInt: number,
  session: "morning" | "evening"
): Promise<boolean> => {
  const db = await openDatabase();

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
};

// Check if both sessions are completed for streak calculation
const areBothSessionsCompleted = async (dateInt: number): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const result = await db.getFirstAsync(
      `SELECT morning_completed_at, evening_completed_at 
       FROM ${ATHKAR_COMPLETED_DAYS_TABLE} 
       WHERE date = ?;`,
      [dateInt]
    );

    if (!result) return false;

    const completedDay = result as any;
    return completedDay.morning_completed_at !== null && completedDay.evening_completed_at !== null;
  } catch (error) {
    console.error("Error checking both sessions completion:", error);
    return false;
  }
};

// Update total counts for existing items (used when shortVersion changes)
const updateTotalCounts = async (
  dateInt: number,
  athkarList: { order: number; count: number }[]
): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const tz = locationStore.getState().locationDetails.timezone;
    const now = timeZonedNow(tz).toISOString();

    console.log(`[Athkar-DB] Updating total counts for date ${dateInt}`);

    await db.withTransactionAsync(async () => {
      for (const athkar of athkarList) {
        const morningThikrId = `${athkar.order}-morning`;
        const eveningThikrId = `${athkar.order}-evening`;

        // Update morning item - if current_count >= new total_count, mark as completed
        await db.runAsync(
          `UPDATE ${ATHKAR_DAILY_ITEMS_TABLE} 
           SET total_count = ?, updated_at = ?
           WHERE date = ? AND thikr_id = ?;`,
          [athkar.count, now, dateInt, morningThikrId]
        );

        // Update evening item - if current_count >= new total_count, mark as completed
        await db.runAsync(
          `UPDATE ${ATHKAR_DAILY_ITEMS_TABLE} 
           SET total_count = ?, updated_at = ?
           WHERE date = ? AND thikr_id = ?;`,
          [athkar.count, now, dateInt, eveningThikrId]
        );
      }
    });

    console.log(
      `[Athkar-DB] Successfully updated total counts for ${athkarList.length} athkar types`
    );
    return true;
  } catch (error) {
    console.error("Error updating total counts:", error);
    return false;
  }
};

const cleanOldData = async (daysToKeep: number = 5): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const tz = locationStore.getState().locationDetails.timezone;
    const cutoffDate = timeZonedNow(tz);
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateInt = dateToInt(cutoffDate);

    await db.withTransactionAsync(async () => {
      // Clean daily items
      await db.runAsync(`DELETE FROM ${ATHKAR_DAILY_ITEMS_TABLE} WHERE date < ?;`, [cutoffDateInt]);

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
};

/** STREAK OPERATIONS */

const getStreakData = async (): Promise<AthkarStreak | null> => {
  const db = await openDatabase();

  try {
    const result = await db.getFirstAsync(`SELECT * FROM ${ATHKAR_STREAK_TABLE} WHERE id = 1;`);

    if (!result) return null;

    return AthkarStreakSchema.parse(result);
  } catch (error) {
    console.error("Error getting streak data:", error);
    return null;
  }
};

// Update streak when both sessions are completed
const updateStreakForDay = async (
  dateInt: number
): Promise<{
  success: boolean;
  currentStreak: number;
  longestStreak: number;
  alreadyCompleted?: boolean;
} | null> => {
  const db = await openDatabase();

  try {
    let result = null;

    await db.withTransactionAsync(async () => {
      // Check if both sessions are completed
      const bothCompleted = await areBothSessionsCompleted(dateInt);

      if (!bothCompleted) {
        result = { success: false, currentStreak: 0, longestStreak: 0 };
        return;
      }

      // Get current streak data
      const streakData = await getStreakData();
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
};

// Reset current streak
const resetCurrentStreak = async (): Promise<boolean> => {
  const db = await openDatabase();

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
};

// Update streak settings
const updateStreakSettings = async (settings: {
  isPaused?: boolean;
  toleranceDays?: number;
}): Promise<boolean> => {
  const db = await openDatabase();

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
};

export const AthkarDB = {
  open: openDatabase,
  initialize: initializeDB,

  // Daily items operations
  initializeDailyItems,
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

  // Utility
  cleanOldData,
};
