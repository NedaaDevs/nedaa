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
  ATHKAR_DAILY_PROGRESS_TABLE,
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

const AthkarProgressItemSchema = z.object({
  count: z.number().min(0),
  completed: z.boolean(),
});

const AthkarSessionProgressSchema = z.record(
  z.string(), // key: "athkarId-type" e.g., "1-morning"
  AthkarProgressItemSchema
);

const AthkarDailyProgressSchema = z.object({
  date: z.number(), // YYYYMMDD format
  morning_progress: z.string(), // JSON string
  evening_progress: z.string(), // JSON string
  morning_completed: z.number().min(0).max(1),
  evening_completed: z.number().min(0).max(1),
  last_updated: z.string(),
  created_at: z.string(),
});

const AthkarCompletedDaySchema = z.object({
  date: z.number(), // YYYYMMDD format
  created_at: z.string(),
});

type AthkarStreak = z.infer<typeof AthkarStreakSchema>;
type AthkarDailyProgress = z.infer<typeof AthkarDailyProgressSchema>;
type AthkarSessionProgress = z.infer<typeof AthkarSessionProgressSchema>;

// Open Database
const openDatabase = async () =>
  await SQLite.openDatabaseAsync(
    ATHKAR_DB_NAME,
    {
      useNewConnection: true,
      enableChangeListener: false, // Disable since we are not using listeners
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

    // Create daily progress table
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${ATHKAR_DAILY_PROGRESS_TABLE} (
        date INTEGER PRIMARY KEY,
        morning_progress TEXT NOT NULL DEFAULT '{}',
        evening_progress TEXT NOT NULL DEFAULT '{}',
        morning_completed INTEGER NOT NULL DEFAULT 0,
        evening_completed INTEGER NOT NULL DEFAULT 0,
        last_updated TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`
    );

    // Create index for faster queries
    await db.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_daily_progress_date 
       ON ${ATHKAR_DAILY_PROGRESS_TABLE}(date DESC);`
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

/** DAILY PROGRESS */

// Get progress for a specific date
const getDailyProgress = async (dateInt: number): Promise<AthkarDailyProgress | null> => {
  const db = await openDatabase();

  try {
    const result = await db.getFirstAsync(
      `SELECT * FROM ${ATHKAR_DAILY_PROGRESS_TABLE} WHERE date = ?;`,
      [dateInt]
    );

    if (!result) return null;

    return AthkarDailyProgressSchema.parse(result);
  } catch (error) {
    console.error("Error getting daily progress:", error);
    return null;
  }
};

// Save or update progress for a specific date
const saveDailyProgress = async (
  dateInt: number,
  morningProgress: AthkarSessionProgress,
  eveningProgress: AthkarSessionProgress,
  morningCompleted: boolean,
  eveningCompleted: boolean
): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const tz = locationStore.getState().locationDetails.timezone;
    const now = timeZonedNow(tz).toISOString() || new Date().toISOString();
    const morningJson = JSON.stringify(morningProgress);
    const eveningJson = JSON.stringify(eveningProgress);

    await db.runAsync(
      `INSERT OR REPLACE INTO ${ATHKAR_DAILY_PROGRESS_TABLE} 
       (date, morning_progress, evening_progress, morning_completed, evening_completed, last_updated, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 
         COALESCE((SELECT created_at FROM ${ATHKAR_DAILY_PROGRESS_TABLE} WHERE date = ?), ?));`,
      [
        dateInt,
        morningJson,
        eveningJson,
        morningCompleted ? 1 : 0,
        eveningCompleted ? 1 : 0,
        now,
        dateInt,
        now,
      ]
    );

    return true;
  } catch (error) {
    console.error("Error saving daily progress:", error);
    return false;
  }
};

// Update only morning progress
const updateMorningProgress = async (
  dateInt: number,
  progress: AthkarSessionProgress,
  isCompleted: boolean
): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const tz = locationStore.getState().locationDetails.timezone;
    const now = timeZonedNow(tz).toISOString() || new Date().toISOString();
    const progressJson = JSON.stringify(progress);

    // First, try to update existing row
    const result = await db.runAsync(
      `UPDATE ${ATHKAR_DAILY_PROGRESS_TABLE} 
       SET morning_progress = ?, 
           morning_completed = ?,
           last_updated = ?
       WHERE date = ?;`,
      [progressJson, isCompleted ? 1 : 0, now, dateInt]
    );

    // If no rows were updated, insert new row
    if (result.changes === 0) {
      await db.runAsync(
        `INSERT INTO ${ATHKAR_DAILY_PROGRESS_TABLE} 
         (date, morning_progress, evening_progress, morning_completed, evening_completed, last_updated, created_at)
         VALUES (?, ?, '{}', ?, 0, ?, ?);`,
        [dateInt, progressJson, isCompleted ? 1 : 0, now, now]
      );
    }

    return true;
  } catch (error) {
    console.error("Error updating morning progress:", error);
    return false;
  }
};

// Update only evening progress
const updateEveningProgress = async (
  dateInt: number,
  progress: AthkarSessionProgress,
  isCompleted: boolean
): Promise<boolean> => {
  const db = await openDatabase();
  try {
    const tz = locationStore.getState().locationDetails.timezone;
    const now = timeZonedNow(tz).toISOString() || new Date().toISOString();
    const progressJson = JSON.stringify(progress);

    // First, try to update existing row
    const result = await db.runAsync(
      `UPDATE ${ATHKAR_DAILY_PROGRESS_TABLE} 
       SET evening_progress = ?, 
           evening_completed = ?,
           last_updated = ?
       WHERE date = ?;`,
      [progressJson, isCompleted ? 1 : 0, now, dateInt]
    );

    // If no rows were updated, insert new row
    if (result.changes === 0) {
      await db.runAsync(
        `INSERT INTO ${ATHKAR_DAILY_PROGRESS_TABLE} 
         (date, morning_progress, evening_progress, morning_completed, evening_completed, last_updated, created_at)
         VALUES (?, '{}', ?, 0, ?, ?, ?);`,
        [dateInt, progressJson, isCompleted ? 1 : 0, now, now]
      );
    }

    return true;
  } catch (error) {
    console.error("Error updating evening progress:", error);
    return false;
  }
};

// Update a single athkar item progress
const updateSingleAthkarProgress = async (
  dateInt: number,
  athkarId: string, // e.g., "1-morning"
  count: number,
  completed: boolean
): Promise<boolean> => {
  await openDatabase();

  try {
    // Determine if it's morning or evening from the athkarId
    const isMorning = athkarId.includes("-morning");

    // Get current progress
    const currentData = await getDailyProgress(dateInt);

    let progress: AthkarSessionProgress = {};

    if (currentData) {
      const currentProgressJson = isMorning
        ? currentData.morning_progress
        : currentData.evening_progress;
      try {
        progress = JSON.parse(currentProgressJson) as AthkarSessionProgress;
      } catch {
        progress = {};
      }
    }

    // Update the specific athkar
    progress[athkarId] = { count, completed };

    // Check if all items in this session are completed
    const allCompleted = Object.values(progress).every((item) => item.completed);

    // Update the appropriate session
    if (isMorning) {
      return await updateMorningProgress(dateInt, progress, allCompleted);
    } else {
      return await updateEveningProgress(dateInt, progress, allCompleted);
    }
  } catch (error) {
    console.error("Error updating single athkar progress:", error);
    return false;
  }
};

// Get recent progress (for debugging/analytics)
const getRecentProgress = async (days: number = 7): Promise<AthkarDailyProgress[]> => {
  const db = await openDatabase();

  try {
    const results = await db.getAllAsync(
      `SELECT * FROM ${ATHKAR_DAILY_PROGRESS_TABLE} 
       ORDER BY date DESC 
       LIMIT ?;`,
      [days]
    );

    if (!results) return [];

    return results
      .map((r) => {
        try {
          return AthkarDailyProgressSchema.parse(r);
        } catch {
          return null;
        }
      })
      .filter((progress): progress is AthkarDailyProgress => progress !== null);
  } catch (error) {
    console.error("Error getting recent progress:", error);
    return [];
  }
};

// Clean old progress data (keep only last 7 days)
const cleanOldProgress = async (daysToKeep: number = 7): Promise<boolean> => {
  const db = await openDatabase();

  try {
    const tz = locationStore.getState().locationDetails.timezone;
    const cutoffDate = timeZonedNow(tz);
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const cutoffDateInt = dateToInt(cutoffDate);

    console.log(`[Athkar-DB] Cleaning progress data older than ${cutoffDate}`);

    await db.runAsync(`DELETE FROM ${ATHKAR_DAILY_PROGRESS_TABLE} WHERE date < ?;`, [
      cutoffDateInt,
    ]);

    console.log(`[Athkar-DB] Progress cleanup completed successfully`);
    return true;
  } catch (error) {
    console.error("Error cleaning old progress:", error);
    return false;
  }
};

// Check if both sessions are completed for streak update
const checkAndUpdateStreakForDate = async (dateInt: number): Promise<boolean> => {
  await openDatabase();

  try {
    const progress = await getDailyProgress(dateInt);

    if (!progress) return false;

    // If both sessions are completed, update the streak
    if (progress.morning_completed && progress.evening_completed) {
      // This will handle the streak update logic
      await updateStreakForDay(dateInt);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking and updating streak:", error);
    return false;
  }
};

/** STREAK */

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
    let success = false;

    await db.withTransactionAsync(async () => {
      const result = await db.getFirstAsync(`SELECT * FROM ${ATHKAR_STREAK_TABLE} WHERE id = 1;`);

      if (!result) throw new Error("No streak data found");

      const currentData = AthkarStreakSchema.parse(result);
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

      success = true;
    });

    return success;
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
      const existingDay = await db.getFirstAsync(
        `SELECT date FROM ${ATHKAR_COMPLETED_DAYS_TABLE} WHERE date = ?;`,
        [dateInt]
      );

      if (existingDay) {
        // Already completed - return current values
        const streakResult = await db.getFirstAsync(
          `SELECT * FROM ${ATHKAR_STREAK_TABLE} WHERE id = 1;`
        );

        if (streakResult) {
          const streakData = AthkarStreakSchema.parse(streakResult);
          result = {
            success: true,
            currentStreak: streakData.current_streak,
            longestStreak: streakData.longest_streak,
            alreadyCompleted: true,
          };
        }
        return;
      }

      // Add the completed day
      await db.runAsync(
        `INSERT INTO ${ATHKAR_COMPLETED_DAYS_TABLE} 
         (date, created_at) 
         VALUES (?, ?);`,
        [dateInt, new Date().toISOString()]
      );

      // Get current streak data
      const streakResult = await db.getFirstAsync(
        `SELECT * FROM ${ATHKAR_STREAK_TABLE} WHERE id = 1;`
      );

      if (!streakResult) throw new Error("No streak data found");

      const streakData = AthkarStreakSchema.parse(streakResult);

      // Determine new streak values
      let newCurrentStreak = 1;
      let shouldIncrement = false;

      if (!streakData.last_streak_date) {
        // First ever completion
        shouldIncrement = true;
      } else {
        const daysSinceLastStreak = dateInt - streakData.last_streak_date;

        if (daysSinceLastStreak === 1) {
          // Consecutive day
          newCurrentStreak = streakData.current_streak + 1;
          shouldIncrement = true;
        } else if (daysSinceLastStreak === 0) {
          // Same day - no change needed
          result = {
            success: true,
            currentStreak: streakData.current_streak,
            longestStreak: streakData.longest_streak,
          };
          return;
        } else if (
          streakData.tolerance_days > 0 &&
          daysSinceLastStreak <= streakData.tolerance_days + 1 &&
          !streakData.is_paused
        ) {
          // Within tolerance
          newCurrentStreak = streakData.current_streak + 1;
          shouldIncrement = true;
        } else {
          // Streak broken - reset to 1
          newCurrentStreak = 1;
          shouldIncrement = true;
        }
      }

      if (shouldIncrement) {
        const newLongestStreak = Math.max(newCurrentStreak, streakData.longest_streak);

        await db.runAsync(
          `UPDATE ${ATHKAR_STREAK_TABLE} 
           SET current_streak = ?, 
               longest_streak = ?, 
               last_streak_date = ?,
               updated_at = ?
           WHERE id = 1;`,
          [newCurrentStreak, newLongestStreak, dateInt, new Date().toISOString()]
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

export const AthkarDB = {
  open: openDatabase,
  initialize: initializeDB,

  // Primary streak operations
  getStreakData,
  incrementStreak,
  resetCurrentStreak,
  updateStreakSettings,
  updateStreakForDay,

  // Completed days operations
  isDayCompleted,
  getRecentCompletedDays,

  // Backup/Recovery
  recalculateStreakFromHistory,
  forceUpdateStreakFromHistory,

  // Progress operations
  getDailyProgress,
  saveDailyProgress,
  updateMorningProgress,
  updateEveningProgress,
  updateSingleAthkarProgress,
  checkAndUpdateStreakForDate,

  // Utility
  cleanOldCompletedDays,
  cleanOldProgress,
  getRecentProgress,
};
