import * as SQLite from "expo-sqlite";
import { getDirectory } from "@/services/db";
import { createSerializedDatabase } from "@/utils/serializedDatabase";
import { AppLogger } from "@/utils/appLogger";

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

const sdb = createSerializedDatabase(async () => {
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
});

export const BackgroundTaskLog = {
  initialize: () => sdb.run(async () => {}),

  log: (
    taskName: string,
    action: string,
    result: "success" | "failed" | "skipped",
    details?: string,
    durationMs?: number
  ) =>
    sdb
      .run(async (db) => {
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
      })
      .catch((error) => {
        console.error("[BackgroundTaskLog] Failed to write log:", error);
      }),

  getRecentLogs: (limit: number = 50): Promise<TaskLogEntry[]> =>
    sdb
      .run((db) =>
        db.getAllAsync<TaskLogEntry>(`SELECT * FROM ${TABLE_NAME} ORDER BY id DESC LIMIT ?`, limit)
      )
      .catch((error) => {
        console.error("[BackgroundTaskLog] Failed to read logs:", error);
        return [] as TaskLogEntry[];
      }),

  clearLogs: () =>
    sdb
      .run((db) => db.runAsync(`DELETE FROM ${TABLE_NAME}`))
      .then(() => undefined)
      .catch((error) => {
        console.error("[BackgroundTaskLog] Failed to clear logs:", error);
      }),
};

// Surface the background-task history in shared diagnostic bundles — it's the key
// evidence for "prayer times didn't update" reports and lives outside the file logger.
AppLogger.registerReportSection("background-tasks", async () => {
  const rows = await BackgroundTaskLog.getRecentLogs(100);
  return rows
    .map(
      (r) =>
        `${r.timestamp} ${r.task_name}/${r.action}: ${r.result}` +
        (r.duration_ms != null ? ` (${r.duration_ms}ms)` : "") +
        (r.details ? ` — ${r.details}` : "")
    )
    .reverse() // oldest first, matching the .log files' chronology
    .join("\n");
});
