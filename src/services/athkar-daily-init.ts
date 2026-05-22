import type * as SQLite from "expo-sqlite";

import { ATHKAR_COMPLETED_DAYS_TABLE, ATHKAR_DAILY_ITEMS_TABLE } from "@/constants/DB";

export type AthkarItem = { id: string; order: number; count: number; type: string };

export type DailyInitLogger = {
  i: (tag: string, msg: string) => void;
  e: (tag: string, msg: string, err: Error) => void;
};

// Pure-ish core of initializeDailyItems: takes the db, lists, a fixed
// timestamp, and a logger as parameters so it can be tested in isolation
// against a fake driver. All concurrency safety lives at the caller (lock +
// withExclusiveTransactionAsync wrapping these statements).
export const initializeDailyItemsCore = async (
  db: SQLite.SQLiteDatabase,
  dateInt: number,
  morningList: AthkarItem[],
  eveningList: AthkarItem[],
  now: string,
  log: DailyInitLogger
): Promise<boolean> => {
  try {
    const totalItems = morningList.length + eveningList.length;
    let didInsert = false;

    await db.withExclusiveTransactionAsync(async (txn) => {
      const existing = await txn.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${ATHKAR_DAILY_ITEMS_TABLE} WHERE date = ?;`,
        [dateInt]
      );
      const existingCount = existing?.count ?? 0;

      if (existingCount >= totalItems) {
        log.i(
          "DB",
          `initializeDailyItems: date=${dateInt} already has ${existingCount} rows, skipping`
        );
        return;
      }

      log.i(
        "DB",
        `initializeDailyItems: date=${dateInt} morning=${morningList.length} evening=${eveningList.length} total=${totalItems} (existing=${existingCount})`
      );

      for (const athkar of morningList) {
        await txn.runAsync(
          `INSERT OR IGNORE INTO ${ATHKAR_DAILY_ITEMS_TABLE}
           (date, thikr_id, current_count, total_count, created_at, updated_at)
           VALUES (?, ?, 0, ?, ?, ?);`,
          [dateInt, athkar.id, athkar.count, now, now]
        );
      }

      for (const athkar of eveningList) {
        await txn.runAsync(
          `INSERT OR IGNORE INTO ${ATHKAR_DAILY_ITEMS_TABLE}
           (date, thikr_id, current_count, total_count, created_at, updated_at)
           VALUES (?, ?, 0, ?, ?, ?);`,
          [dateInt, athkar.id, athkar.count, now, now]
        );
      }

      await txn.runAsync(
        `INSERT OR IGNORE INTO ${ATHKAR_COMPLETED_DAYS_TABLE}
         (date, morning_completed_at, evening_completed_at, created_at, updated_at)
         VALUES (?, NULL, NULL, ?, ?);`,
        [dateInt, now, now]
      );

      didInsert = true;
    });

    if (didInsert) {
      log.i(
        "DB",
        `initializeDailyItems: successfully inserted rows for date=${dateInt} (total=${morningList.length + eveningList.length})`
      );
    }
    return true;
  } catch (error) {
    log.e(
      "DB",
      `initializeDailyItems failed for date=${dateInt}`,
      error instanceof Error ? error : new Error(String(error))
    );
    return false;
  }
};
