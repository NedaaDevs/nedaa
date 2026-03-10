import * as SQLite from "expo-sqlite";
import { getDirectory } from "@/services/db";

const BG_LOG_DB_NAME = "background_task_logs.db";
const TABLE_NAME = "task_logs";
const MAX_LOG_ENTRIES = 100;

export type TaskLogEntry = {
  id: number;
  timestamp: string;
  task_name: string;
  action: string;
  result: "success" | "failed" | "skipped";
  details: string | null;
  duration_ms: number | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const openLogDatabase = (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync(
          BG_LOG_DB_NAME,
          { useNewConnection: true },
          await getDirectory()
        );
        await db.execAsync(
          `PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            task_name TEXT NOT NULL,
            action TEXT NOT NULL,
            result TEXT NOT NULL CHECK(result IN ('success', 'failed', 'skipped')),
            details TEXT,
            duration_ms INTEGER
          );`
        );
        return db;
      } catch (error) {
        dbPromise = null;
        console.error("[BackgroundTaskLog] Error init db:", error);
        throw error;
      }
    })();
  }
  return dbPromise;
};

const closeLogDatabase = async (): Promise<void> => {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      dbPromise = null;
      await db.closeAsync();
    } catch (error) {
      console.error("[BackgroundTaskLog] Error closing database:", error);
    }
  }
};

export const BackgroundTaskLog = {
  initialize: async () => {
    await openLogDatabase();
  },

  close: closeLogDatabase,

  log: async (
    taskName: string,
    action: string,
    result: "success" | "failed" | "skipped",
    details?: string,
    durationMs?: number
  ) => {
    try {
      const db = await openLogDatabase();
      await db.runAsync(
        `INSERT INTO ${TABLE_NAME} (task_name, action, result, details, duration_ms) VALUES (?, ?, ?, ?, ?)`,
        taskName,
        action,
        result,
        details ?? null,
        durationMs ?? null
      );

      // Prune old entries to keep the table small
      await db.runAsync(
        `DELETE FROM ${TABLE_NAME} WHERE id NOT IN (SELECT id FROM ${TABLE_NAME} ORDER BY id DESC LIMIT ?)`,
        MAX_LOG_ENTRIES
      );
    } catch (error) {
      console.error("[BackgroundTaskLog] Failed to write log:", error);
    }
  },

  getRecentLogs: async (limit: number = 50): Promise<TaskLogEntry[]> => {
    try {
      const db = await openLogDatabase();
      return await db.getAllAsync<TaskLogEntry>(
        `SELECT * FROM ${TABLE_NAME} ORDER BY id DESC LIMIT ?`,
        limit
      );
    } catch (error) {
      console.error("[BackgroundTaskLog] Failed to read logs:", error);
      return [];
    }
  },

  clearLogs: async () => {
    try {
      const db = await openLogDatabase();
      await db.runAsync(`DELETE FROM ${TABLE_NAME}`);
    } catch (error) {
      console.error("[BackgroundTaskLog] Failed to clear logs:", error);
    }
  },
};
