import * as SQLite from "expo-sqlite";
import { getDirectory } from "@/services/db";
import { createSerializedDatabase } from "@/utils/serializedDatabase";
import { AppLogger } from "@/utils/appLogger";
import { ExpoDiagnosticsModule } from "../../modules/expo-diagnostics/src";

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

// The worker-queue depth is the number that tells a serial backlog apart from duplicate
// concurrent roots; only the second floods the per-uid alarm ceiling. It lives outside the
// file logger, so it is registered as its own section.
const QUEUE_READ_TIMEOUT_MS = 2000;

const describeWorkerQueue = async (): Promise<string> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // buildReport awaits each section with no time bound and one of its callers is the
  // post-crash prompt, so a native read that never settles would hold up the whole report.
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), QUEUE_READ_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([ExpoDiagnosticsModule.readBackgroundWorkerQueue(), timeout]);

    if (result === "timeout") return "read timed out";
    if (result.status === "unsupported") return "no WorkManager on this platform";
    if (result.status === "error") return `read failed: ${result.message}`;

    const c = result.counts;
    return [
      `unique: ${c.uniqueName}`,
      `enqueued=${c.enqueued} running=${c.running} blocked=${c.blocked}`,
      `unfinished=${c.unfinished} total=${c.total}`,
      // Finished states are pruned after about a day, so this is a recent window.
      `finished(<=1d)=${c.succeeded + c.failed + c.cancelled} attempts: max=${c.maxRunAttemptCount}`,
    ].join("\n");
  } finally {
    if (timer) clearTimeout(timer);
  }
};

AppLogger.registerReportSection("background-worker-queue", describeWorkerQueue);
