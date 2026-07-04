import { sharedDb } from "@/services/db";
import { createDebouncedQueue } from "@/utils/debounce";
import type { UmrahRecord } from "@/types/umrah";

import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("umrah");

const UMRAH_HISTORY_TABLE = "umrah_history" as const;

const debouncedSave = createDebouncedQueue(async (record: UmrahRecord) => {
  await sharedDb.run((db) =>
    db.runAsync(
      `INSERT INTO ${UMRAH_HISTORY_TABLE} (id, started_at, completed_at, duration_minutes, hijri_date, gregorian_date) VALUES (?, ?, ?, ?, ?, ?);`,
      [
        record.id,
        record.startedAt,
        record.completedAt,
        record.durationMinutes,
        record.hijriDate,
        record.gregorianDate,
      ]
    )
  );
}, 500);

const initializeDB = () =>
  sharedDb.run(async (db) => {
    try {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS ${UMRAH_HISTORY_TABLE} (
          id TEXT PRIMARY KEY,
          started_at TEXT NOT NULL,
          completed_at TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          hijri_date TEXT NOT NULL,
          gregorian_date TEXT NOT NULL
        );`
      );
    } catch (error) {
      console.error("[Umrah DB] Error initializing database:", error);
      throw error;
    }
  });

const saveRecord = async (record: UmrahRecord): Promise<boolean> => {
  try {
    debouncedSave.add(record.id, record);
    return true;
  } catch (error) {
    log.e("DB", "saveRecord failed", error instanceof Error ? error : undefined);
    return false;
  }
};

const getHistory = (): Promise<UmrahRecord[]> =>
  sharedDb.run(async (db) => {
    try {
      const results = await db.getAllAsync<{
        id: string;
        started_at: string;
        completed_at: string;
        duration_minutes: number;
        hijri_date: string;
        gregorian_date: string;
      }>(`SELECT * FROM ${UMRAH_HISTORY_TABLE} ORDER BY completed_at DESC;`);

      return (results || []).map((r) => ({
        id: r.id,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        durationMinutes: r.duration_minutes,
        hijriDate: r.hijri_date,
        gregorianDate: r.gregorian_date,
      }));
    } catch (error) {
      log.e("DB", "getHistory failed", error instanceof Error ? error : undefined);
      return [];
    }
  });

const deleteRecord = (id: string): Promise<boolean> =>
  sharedDb.run(async (db) => {
    try {
      await db.runAsync(`DELETE FROM ${UMRAH_HISTORY_TABLE} WHERE id = ?;`, [id]);
      return true;
    } catch (error) {
      log.e("DB", "deleteRecord failed", error instanceof Error ? error : undefined);
      return false;
    }
  });

export const UmrahDB = {
  initialize: initializeDB,
  saveRecord,
  getHistory,
  deleteRecord,
  flush: debouncedSave.flush,
};
