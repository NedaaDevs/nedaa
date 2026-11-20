import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import { QADA_ENTRY_TYPE, type QadaEntryType } from "@/constants/Qada";
import { QADA_HISTORY_TABLE, getCompletedCountBetweenWith } from "@/services/qada-db";

// The window's SQL runs on Node's SQLite, so the test checks its bounds.
jest.mock("expo-sqlite", () => {
  type MockStatement = {
    run: (...params: unknown[]) => unknown;
    get: (...params: unknown[]) => unknown;
  };
  type MockDatabase = { exec: (sql: string) => void; prepare: (sql: string) => MockStatement };
  const { DatabaseSync } = jest.requireActual<{
    DatabaseSync: new (path: string) => MockDatabase;
  }>("node:sqlite");

  return {
    openDatabaseAsync: async () => {
      const db = new DatabaseSync(":memory:");
      return {
        execAsync: async (sql: string) => db.exec(sql),
        runAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).run(...params),
        getFirstAsync: async (sql: string, params: unknown[] = []) =>
          db.prepare(sql).get(...params) ?? null,
      };
    },
  };
});

const START = "2026-09-05T21:00:00.000Z";
const INSIDE = "2026-09-06T09:00:00.000Z";
const END = "2026-09-06T21:00:00.000Z";

const openHistory = async (): Promise<SQLiteDatabase> => {
  const db = await openDatabaseAsync(":memory:");
  await db.execAsync(
    `CREATE TABLE ${QADA_HISTORY_TABLE} (type TEXT NOT NULL, count INTEGER NOT NULL, updated_at TEXT NOT NULL);`
  );
  return db;
};

const seed = (db: SQLiteDatabase, type: QadaEntryType, count: number, updatedAt: string) =>
  db.runAsync(`INSERT INTO ${QADA_HISTORY_TABLE} (type, count, updated_at) VALUES (?, ?, ?);`, [
    type,
    count,
    updatedAt,
  ]);

describe("getCompletedCountBetweenWith", () => {
  test("sums completed days from the window's start, up to but not at its end", async () => {
    const db = await openHistory();
    await seed(db, QADA_ENTRY_TYPE.COMPLETED, 1, START);
    await seed(db, QADA_ENTRY_TYPE.COMPLETED, 2, INSIDE);
    await seed(db, QADA_ENTRY_TYPE.COMPLETED, 4, END);
    await seed(db, QADA_ENTRY_TYPE.ADDED, 8, INSIDE);

    await expect(getCompletedCountBetweenWith(db, START, END)).resolves.toBe(3);
  });

  test("an empty window reads as zero", async () => {
    const db = await openHistory();
    await expect(getCompletedCountBetweenWith(db, START, END)).resolves.toBe(0);
  });
});
