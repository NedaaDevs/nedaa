import type { SQLiteDatabase } from "expo-sqlite";

import { createAsyncLock } from "@/utils/asyncLock";

// A connection wrapper that serializes every logical operation through a single
// lock and exposes the raw SQLiteDatabase only inside run(). Holding the lock for
// the whole run() callback makes multi-statement operations atomic against each
// other — closing the interleaving gaps that expo-sqlite leaves between statements.
export type SerializedDatabase = {
  run: <T>(operation: (db: SQLiteDatabase) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

export const createSerializedDatabase = (
  open: () => Promise<SQLiteDatabase>
): SerializedDatabase => {
  const lock = createAsyncLock();
  let dbPromise: Promise<SQLiteDatabase> | null = null;

  const getDb = (): Promise<SQLiteDatabase> => {
    if (!dbPromise) {
      dbPromise = open().catch((error: unknown) => {
        dbPromise = null; // reset so the next run() retries the open
        throw error;
      });
    }
    return dbPromise;
  };

  const run = <T>(operation: (db: SQLiteDatabase) => Promise<T>): Promise<T> =>
    lock(async () => {
      const db = await getDb();
      return operation(db);
    });

  const close = (): Promise<void> =>
    lock(async () => {
      const current = dbPromise;
      dbPromise = null;
      if (!current) return;
      const db = await current.catch(() => null);
      await db?.closeAsync();
    });

  return { run, close };
};
