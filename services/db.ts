import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { Paths } from "expo-file-system/next";
import { z } from "zod";

// Constants
import { DB_NAME, TABLE_NAME } from "@/constants/DB";
import { appGroupId } from "@/constants/App";

// Enums
import { PlatformType } from "@/enums/app";
import { PrayerTimesResponse } from "@/types/prayerTimes";

// Utils
import { timestampToDateInt } from "@/utils/date";

export type PrayerTimesDBEntry = {
  date: number;
  timezone: string;
  timings: string;
  other_timings: string;
};

const PrayerTimesDBSchema = z.object({
  date: z.number(),
  timezone: z.string(),
  timings: z.string(),
  other_timings: z.string(),
});

type SuccessInsert = {
  success: boolean;
  insertedCount: number;
  error?: undefined;
};
type FailedInsert = {
  success: boolean;
  error: Error;
  insertedCount: number;
};

type InsertResult = SuccessInsert | FailedInsert;

export const getDirectory = async (): Promise<string> => {
  // for iOS make the db shared in the app group, so we can access the db from the widgets and other app extensions
  if (Platform.OS === PlatformType.IOS) {
    return Paths.appleSharedContainers?.[appGroupId]?.uri;
  }

  return SQLite.defaultDatabaseDirectory;
};

// Open Database
const openDatabase = async () =>
  await SQLite.openDatabaseAsync(
    DB_NAME,
    {
      useNewConnection: true,
    },
    await getDirectory()
  );

// Initialize Database Schema
const initializeDB = async () => {
  const db = await openDatabase();

  try {
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        date INTEGER PRIMARY KEY,
        timezone TEXT NOT NULL,
        timings TEXT NOT NULL,
        other_timings TEXT NOT NULL
      );`
    );
  } catch (error: unknown) {
    console.error("Error init db => ", error);
  }
};

const batchInsertPrayerTimesEntries = async (
  entries: PrayerTimesDBEntry[]
): Promise<InsertResult> => {
  if (entries.length === 0) {
    return { success: true, insertedCount: 0 };
  }

  const db = await openDatabase();

  try {
    let insertedCount = 0;

    await db.withTransactionAsync(async () => {
      for (const entry of entries) {
        try {
          // Validate against schema and prepare data
          const validatedEntry = PrayerTimesDBSchema.parse(entry);

          console.debug(`[DB] Inserting entry for date: ${validatedEntry.date}`);

          await db.runAsync(
            `INSERT OR REPLACE INTO ${TABLE_NAME} 
           (date, timezone, timings, other_timings) 
           VALUES (?, ?, ?, ?);`,
            [
              validatedEntry.date,
              validatedEntry.timezone,
              validatedEntry.timings,
              validatedEntry.other_timings,
            ]
          );
          insertedCount++;
        } catch (entryError) {
          console.error("[DB] Error processing entry:", {
            entry,
            error: entryError,
          });
          throw entryError; // Abort transaction on error
        }
      }
    });

    return { success: true, insertedCount };
  } catch (error) {
    console.error("[DB] Critical error during batch insert:", error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      insertedCount: 0,
    };
  }
};

const processPrayerTimesData = (data: PrayerTimesResponse): PrayerTimesDBEntry[] => {
  const results: PrayerTimesDBEntry[] = [];

  try {
    const { timezone, months } = data;

    for (const [_, monthEntries] of Object.entries(months)) {
      for (const entry of monthEntries) {
        // Validate date format
        const dateInt = timestampToDateInt(parseInt(entry.date), timezone);

        if (isNaN(dateInt)) {
          throw new Error(`Invalid date format: ${entry.date}`);
        }

        // Destructure timings
        const { fajr, dhuhr, asr, maghrib, isha, ...otherTimings } = entry.timings;

        // Create and validate entry
        const dbEntry = PrayerTimesDBSchema.parse({
          date: dateInt,
          timezone,
          timings: JSON.stringify({ fajr, dhuhr, asr, maghrib, isha }),
          other_timings: JSON.stringify(otherTimings),
        });

        results.push(dbEntry);
      }
    }

    return results;
  } catch (error) {
    throw new Error("Invalid prayer times data structure", { cause: error });
  }
};

const insertPrayerTimes = async (data: PrayerTimesResponse) => {
  try {
    const processedEntries = PrayerTimesDB.processPrayerTimesData(data);
    const result = await PrayerTimesDB.batchInsertPrayerTimesEntries(processedEntries);

    if (!result.success) {
      throw result.error;
    }

    return result;
  } catch (error) {
    console.error("[DB] Insertion process failed:", error);
    throw error;
  }
};

export const PrayerTimesDB = {
  open: openDatabase,
  initialize: initializeDB,
  batchInsertPrayerTimesEntries,
  processPrayerTimesData,
  insertPrayerTimes,
};
