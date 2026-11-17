import { ATHKAR_TYPE } from "@/constants/Athkar";
import { AthkarDB } from "@/services/athkar-db";

// The expo-sqlite calls under test run on Node's SQLite, so the SQL executes.
jest.mock("expo-sqlite", () => {
  type MockStatement = {
    run: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
  };
  type MockDatabase = {
    exec: (sql: string) => void;
    prepare: (sql: string) => MockStatement;
    close: () => void;
  };
  const { DatabaseSync } = jest.requireActual<{
    DatabaseSync: new (path: string) => MockDatabase;
  }>("node:sqlite");

  return {
    openDatabaseAsync: async () => {
      const db = new DatabaseSync(":memory:");
      const transaction = async (task: (txn: unknown) => Promise<void>) => {
        db.exec("BEGIN");
        try {
          await task(handle);
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      };
      const handle = {
        execAsync: async (sql: string) => db.exec(sql),
        runAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).run(...params),
        getAllAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).all(...params),
        getFirstAsync: async (sql: string, params: unknown[] = []) =>
          db.prepare(sql).get(...params) ?? null,
        withTransactionAsync: transaction,
        withExclusiveTransactionAsync: transaction,
        closeAsync: async () => db.close(),
      };
      return handle;
    },
  };
});
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

// One connection serves the file, so each test writes its own day.
const DAYS = { NO_ROW: 20261117, SEEDED: 20261118, WRITE_FIRST: 20261119 } as const;
type Day = (typeof DAYS)[keyof typeof DAYS];
const ID = `5-${ATHKAR_TYPE.MORNING}`;
const TARGET = 3;

const stored = async (day: Day) => {
  const rows = await AthkarDB.getSessionItems(day, ATHKAR_TYPE.MORNING);
  return rows.map(({ thikr_id, current_count, total_count }) => ({
    thikr_id,
    current_count,
    total_count,
  }));
};

const seedDay = (day: Day) =>
  AthkarDB.initializeDailyItems(
    day,
    [{ id: ID, order: 5, count: TARGET, type: ATHKAR_TYPE.MORNING }],
    []
  );

describe("AthkarDB.updateAthkarCount on SQLite", () => {
  it("creates the row when the day has none", async () => {
    await expect(AthkarDB.updateAthkarCount(DAYS.NO_ROW, ID, 2, TARGET)).resolves.toBe(true);
    await expect(stored(DAYS.NO_ROW)).resolves.toEqual([
      { thikr_id: ID, current_count: 2, total_count: TARGET },
    ]);
  });

  it("keeps the stored target and one row for each dhikr", async () => {
    await seedDay(DAYS.SEEDED);
    await AthkarDB.updateAthkarCount(DAYS.SEEDED, ID, 1, 99);
    await AthkarDB.updateAthkarCount(DAYS.SEEDED, ID, 2, 99);
    await expect(stored(DAYS.SEEDED)).resolves.toEqual([
      { thikr_id: ID, current_count: 2, total_count: TARGET },
    ]);
  });

  it("the daily init keeps a count written before it", async () => {
    await AthkarDB.updateAthkarCount(DAYS.WRITE_FIRST, ID, 2, TARGET);
    await seedDay(DAYS.WRITE_FIRST);
    await expect(stored(DAYS.WRITE_FIRST)).resolves.toEqual([
      { thikr_id: ID, current_count: 2, total_count: TARGET },
    ]);
  });
});
