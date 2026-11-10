import { TABLE_NAME } from "@/constants/DB";
import { PrayerTimesDB, sharedDb, type PrayerTimesDBEntry } from "@/services/db";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";

// The expo-sqlite calls under test run on Node's SQLite, so the SQL executes.
jest.mock("expo-sqlite", () => {
  type MockStatement = {
    run: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
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
      return {
        execAsync: async (sql: string) => db.exec(sql),
        runAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).run(...params),
        getAllAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).all(...params),
        withTransactionAsync: async (task: () => Promise<void>) => {
          db.exec("BEGIN");
          try {
            await task();
            db.exec("COMMIT");
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        },
        closeAsync: async () => db.close(),
      };
    },
  };
});

const LAST_KEPT_DAY = 20261231;
const KEPT_DAYS = [20261230, LAST_KEPT_DAY];
const LATER_DAYS = [20270101, 20270215];

const storedDay = (date: number): PrayerTimesDBEntry => ({
  date,
  timezone: RIYADH_ZONE,
  timings: "{}",
  other_timings: "{}",
});

const storedDates = () =>
  PrayerTimesDB.run(async (db) => {
    const rows = await db.getAllAsync<Pick<PrayerTimesDBEntry, "date">>(
      `SELECT date FROM ${TABLE_NAME} ORDER BY date;`
    );
    return rows.map(({ date }) => date);
  });

describe("PrayerTimesDB.deleteDaysAfter on SQLite", () => {
  // A closed connection reopens as a new in-memory database.
  afterEach(() => sharedDb.close());

  it("deletes only the days after the last kept day", async () => {
    await PrayerTimesDB.batchInsertPrayerTimesEntries([...KEPT_DAYS, ...LATER_DAYS].map(storedDay));

    await expect(PrayerTimesDB.deleteDaysAfter(LAST_KEPT_DAY)).resolves.toBe(true);
    await expect(storedDates()).resolves.toEqual(KEPT_DAYS);
  });

  it("returns false when the delete fails", async () => {
    await PrayerTimesDB.run((db) => db.execAsync(`DROP TABLE ${TABLE_NAME};`));

    await expect(PrayerTimesDB.deleteDaysAfter(LAST_KEPT_DAY)).resolves.toBe(false);
  });
});
