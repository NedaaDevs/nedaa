import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { Paths } from "expo-file-system/next";

// Constants
import { DB_NAME, TABLE_NAME } from "@/constants/DB";
import { appGroupId } from "@/constants/App";

// Enums
import { PlatformType } from "@/enums/app";

export const getDirectory = async (): Promise<string> => {
  // for iOS make the db shared in the app group, so we can access the db from the widgets and other app extensions
  if (Platform.OS === PlatformType.IOS) {
    return Paths.appleSharedContainers?.[appGroupId]?.uri;
  }

  return SQLite.defaultDatabaseDirectory;
};

// Open Database
const openDatabase = async () =>
  await SQLite.openDatabaseAsync(DB_NAME, undefined, await getDirectory());

// Initialize Database Schema
const initializeDB = async () => {
  const db = await openDatabase();

  try {
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        date INTEGER PRIMARY KEY,
        month INTEGER NOT NULL,
        timezone TEXT NOT NULL,
        timings TEXT NOT NULL,
        other_timings TEXT NOT NULL
      );`,
    );

    await db.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_month
        ON ${TABLE_NAME}(month);`,
    );
  } catch (error: unknown) {
    console.error("Error init db => ", error);
  }
};

export const PrayerTimesDB = {
  open: openDatabase,
  initialize: initializeDB,
};
