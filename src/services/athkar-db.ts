import * as SQLite from "expo-sqlite";
import { z } from "zod";
import { getDirectory } from "@/services/db";
import { dateToInt } from "@/utils/date";

// Constants
const ATHKAR_STREAK_TABLE = "athkar_streak";
const ATHKAR_COMPLETED_DAYS_TABLE = "athkar_completed_days";

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

const AthkarCompletedDaySchema = z.object({
  date: z.number(), // YYYYMMDD format
  created_at: z.string(),
});

type AthkarStreak = z.infer<typeof AthkarStreakSchema>;

// Open Database
const openDatabase = async () =>
  await SQLite.openDatabaseAsync(
    "athkar.db",
    {
      useNewConnection: true,
    },
    await getDirectory()
  );

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

    // Create completed days table - only stores days where BOTH sessions completed
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${ATHKAR_COMPLETED_DAYS_TABLE} (
        date INTEGER PRIMARY KEY,
        created_at TEXT NOT NULL
      );`
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

// Increment streak by one day
const incrementStreak = async (dateInt: number): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const currentData = await getStreakData();
    if (!currentData) return false;

    const newCurrentStreak = currentData.current_streak + 1;
    const newLongestStreak = Math.max(newCurrentStreak, currentData.longest_streak);

    await db.runAsync(
      `UPDATE ${ATHKAR_STREAK_TABLE} 
       SET current_streak = ?, 
           longest_streak = ?, 
           last_streak_date = ?,
           updated_at = ?
       WHERE id = 1;`,
      [newCurrentStreak, newLongestStreak, dateInt, new Date().toISOString()]
    );

    return true;
  } catch (error) {
    console.error("Error incrementing streak:", error);
    return false;
  }
};

// Reset current streak (but preserve longest)
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

const addCompletedDay = async (dateInt: number): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT OR IGNORE INTO ${ATHKAR_COMPLETED_DAYS_TABLE} 
       (date, created_at) 
       VALUES (?, ?);`,
      [dateInt, now]
    );

    return true;
  } catch (error) {
    console.error("Error adding completed day:", error);
    return false;
  }
};

const isDayCompleted = async (dateInt: number): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const result = await db.getFirstAsync(
      `SELECT date FROM ${ATHKAR_COMPLETED_DAYS_TABLE} WHERE date = ?;`,
      [dateInt]
    );

    return !!result;
  } catch (error) {
    console.error("Error checking completed day:", error);
    return false;
  }
};

const getRecentCompletedDays = async (limit: number = 30): Promise<number[]> => {
  const db = await openDatabase();

  try {
    const results = await db.getAllAsync(
      `SELECT date FROM ${ATHKAR_COMPLETED_DAYS_TABLE} 
       ORDER BY date DESC 
       LIMIT ?;`,
      [limit]
    );

    if (!results) return [];

    // Validate each result
    return results
      .map((r) => {
        try {
          const validated = AthkarCompletedDaySchema.parse(r);
          return validated.date;
        } catch {
          return null;
        }
      })
      .filter((date): date is number => date !== null);
  } catch (error) {
    console.error("Error getting recent completed days:", error);
    return [];
  }
};

// Recalculate streak from history (backup method)
const recalculateStreakFromHistory = async (): Promise<{
  currentStreak: number;
  lastStreakDate: number | null;
} | null> => {
  const db = await openDatabase();

  try {
    // Get all completed days ordered by date DESC
    const results = await db.getAllAsync(
      `SELECT date FROM ${ATHKAR_COMPLETED_DAYS_TABLE} 
       ORDER BY date DESC;`
    );

    if (!results || results.length === 0) {
      return { currentStreak: 0, lastStreakDate: null };
    }

    // Validate and extract dates
    const dates = results
      .map((r) => {
        try {
          const validated = AthkarCompletedDaySchema.parse(r);
          return validated.date;
        } catch {
          return null;
        }
      })
      .filter((date): date is number => date !== null);

    if (dates.length === 0) {
      return { currentStreak: 0, lastStreakDate: null };
    }

    // Calculate consecutive days
    let streak = 1;
    let currentDate = dates[0];

    for (let i = 1; i < dates.length; i++) {
      if (dates[i] === currentDate - 1) {
        streak++;
        currentDate = dates[i];
      } else {
        break;
      }
    }

    return { currentStreak: streak, lastStreakDate: dates[0] };
  } catch (error) {
    console.error("Error recalculating streak from history:", error);
    return null;
  }
};

// Force update streak from history (for data recovery)
const forceUpdateStreakFromHistory = async (): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const calculated = await recalculateStreakFromHistory();
    if (!calculated) return false;

    const currentData = await getStreakData();
    if (!currentData) return false;

    // Only update if calculated is different or longest needs updating
    const newLongest = Math.max(calculated.currentStreak, currentData.longest_streak);

    await db.runAsync(
      `UPDATE ${ATHKAR_STREAK_TABLE} 
       SET current_streak = ?, 
           longest_streak = ?, 
           last_streak_date = ?,
           updated_at = ?
       WHERE id = 1;`,
      [calculated.currentStreak, newLongest, calculated.lastStreakDate, new Date().toISOString()]
    );

    return true;
  } catch (error) {
    console.error("Error forcing streak update:", error);
    return false;
  }
};

// Clean old history while preserving streak data
const cleanOldCompletedDays = async (daysToKeep: number = 365): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateInt = dateToInt(cutoffDate);
    console.log(`[Athkar-DB] Cleaning up prayer times data older than ${cutoffDate}`);

    await db.runAsync(`DELETE FROM ${ATHKAR_COMPLETED_DAYS_TABLE} WHERE date < ?;`, [
      cutoffDateInt,
    ]);
    console.log(`[Athkar-DB] Cleanup completed successfully`);
    return true;
  } catch (error) {
    console.error("Error cleaning old completed days:", error);
    return false;
  }
};

export const AthkarStreakDB = {
  open: openDatabase,
  initialize: initializeDB,

  // Primary streak operations
  getStreakData,
  incrementStreak,
  resetCurrentStreak,
  updateStreakSettings,

  // Completed days operations
  addCompletedDay,
  isDayCompleted,
  getRecentCompletedDays,

  // Backup/Recovery
  recalculateStreakFromHistory,
  forceUpdateStreakFromHistory,

  // Utility
  cleanOldCompletedDays,
};
