import { QADA_ENTRY_STATUS, QADA_ENTRY_TYPE } from "@/constants/Qada";
import { QADA_FASTS_TABLE, QADA_HISTORY_TABLE, QadaDB } from "@/services/qada-db";

/** A statement the mock database fails, or runs as a no-op. */
type Fault = { match: RegExp; kind: "throw" | "noop" };
let mockFault: Fault | null = null;

// The expo-sqlite calls under test run on Node's SQLite, so the SQL executes.
jest.mock("expo-sqlite", () => {
  type MockStatement = {
    run: (...params: unknown[]) => { changes: number | bigint; lastInsertRowid: number | bigint };
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
      const run = (sql: string, params: unknown[]) => {
        if (mockFault?.match.test(sql)) {
          if (mockFault.kind === "throw") throw new Error("fault");
          return { changes: 0, lastInsertRowId: 0 };
        }
        const result = db.prepare(sql).run(...params);
        return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
      };
      return {
        execAsync: async (sql: string) => db.exec(sql),
        runAsync: async (sql: string, params: unknown[] = []) => run(sql, params),
        withTransactionAsync: async (task: () => Promise<void>) => {
          db.exec("BEGIN;");
          try {
            await task();
            db.exec("COMMIT;");
          } catch (error) {
            db.exec("ROLLBACK;");
            throw error;
          }
        },
        getAllAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).all(...params),
        getFirstAsync: async (sql: string, params: unknown[] = []) =>
          db.prepare(sql).get(...params) ?? null,
        closeAsync: async () => db.close(),
      };
    },
  };
});
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

const totals = async () => {
  const row = await QadaDB.getQadaFast();
  return { missed: row?.total_missed, completed: row?.total_completed };
};

// Newest first; rows written in one millisecond tie on created_at, so id orders them.
const batches = async () =>
  (await QadaDB.getHistory())
    .map(({ id, count, status }) => ({ id, count, status }))
    .sort((a, b) => b.id - a.id);

const latestCompletion = async () => {
  const [row] = await QadaDB.getCompletions();
  if (!row) throw new Error("no completion recorded");
  return row;
};

describe("QadaDB completions on SQLite", () => {
  beforeAll(() => QadaDB.initialize());
  beforeEach(() => {
    mockFault = null;
    return QadaDB.resetAll();
  });

  it("returns the id of the day it records", async () => {
    await QadaDB.addMissedFasts(2);
    const [batch] = await batches();

    const id = await QadaDB.completeOneDayFromEntry(batch.id);

    expect(id).toBe((await latestCompletion()).id);
  });

  it("records nothing for a batch that is not there", async () => {
    await expect(QadaDB.completeOneDayFromEntry(404)).resolves.toBeNull();
  });

  it("names the newest day by id, whatever the clock said", async () => {
    await QadaDB.addMissedFasts(3);
    const [batch] = await batches();
    jest.useFakeTimers({ now: Date.now() + 86_400_000 });
    try {
      await QadaDB.completeOneDayFromEntry(batch.id);
    } finally {
      jest.useRealTimers();
    }
    const later = await QadaDB.completeOneDayFromEntry(batch.id);

    expect(await QadaDB.getNewestCompletionId()).toBe(later);
  });

  it("lists each recorded day, newest first", async () => {
    await QadaDB.addMissedFasts(3);
    const [batch] = await batches();
    await QadaDB.completeOneDayFromEntry(batch.id);
    await QadaDB.completeOneDayFromEntry(batch.id);

    const rows = await QadaDB.getCompletions();

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.type === QADA_ENTRY_TYPE.COMPLETED)).toBe(true);
    expect(rows[0].id).toBeGreaterThan(rows[1].id);
  });

  it("gives an undone day back to the batch it came off", async () => {
    await QadaDB.addMissedFasts(3);
    const [batch] = await batches();
    await QadaDB.completeOneDayFromEntry(batch.id);

    await expect(QadaDB.restoreCompletion((await latestCompletion()).id)).resolves.toBe(true);

    expect(await totals()).toEqual({ missed: 3, completed: 0 });
    expect(await batches()).toEqual([
      { id: batch.id, count: 3, status: QADA_ENTRY_STATUS.PENDING },
    ]);
    expect(await QadaDB.getCompletions()).toEqual([]);
  });

  it("gives the day to the oldest open batch", async () => {
    await QadaDB.addMissedFasts(2, "older");
    await QadaDB.addMissedFasts(5, "newer");
    const [newer, older] = await batches();
    await QadaDB.completeOneDayFromEntry(newer.id);

    await QadaDB.restoreCompletion((await latestCompletion()).id);

    expect(await batches()).toEqual([
      { id: newer.id, count: 4, status: QADA_ENTRY_STATUS.PENDING },
      { id: older.id, count: 3, status: QADA_ENTRY_STATUS.PENDING },
    ]);
  });

  it("reopens the last finished batch when none is open", async () => {
    await QadaDB.addMissedFasts(1);
    const [batch] = await batches();
    await QadaDB.completeOneDayFromEntry(batch.id);

    await QadaDB.restoreCompletion((await latestCompletion()).id);

    expect(await batches()).toEqual([
      { id: batch.id, count: 1, status: QADA_ENTRY_STATUS.PENDING },
    ]);
    expect(await totals()).toEqual({ missed: 1, completed: 0 });
  });

  it("returns every day of a batch finished at once", async () => {
    await QadaDB.addMissedFasts(4);
    const [batch] = await batches();
    await QadaDB.updateEntryStatus(batch.id, QADA_ENTRY_STATUS.COMPLETED);

    await QadaDB.restoreCompletion((await latestCompletion()).id);

    expect(await totals()).toEqual({ missed: 4, completed: 0 });
    expect(await batches()).toEqual([
      { id: batch.id, count: 4, status: QADA_ENTRY_STATUS.PENDING },
    ]);
  });

  it("opens a batch for the day when every batch was removed", async () => {
    await QadaDB.addMissedFasts(2);
    const [batch] = await batches();
    await QadaDB.completeOneDayFromEntry(batch.id);
    await QadaDB.updateEntryStatus(batch.id, QADA_ENTRY_STATUS.DELETED);

    await QadaDB.restoreCompletion((await latestCompletion()).id);

    const open = (await batches()).filter(({ status }) => status === QADA_ENTRY_STATUS.PENDING);
    expect(open.map(({ count }) => count)).toEqual([1]);
    expect(await totals()).toEqual({ missed: 1, completed: 0 });
  });

  it("changes nothing when a later write fails", async () => {
    await QadaDB.addMissedFasts(3);
    const [batch] = await batches();
    await QadaDB.completeOneDayFromEntry(batch.id);
    mockFault = { match: new RegExp(`^UPDATE ${QADA_FASTS_TABLE}`), kind: "throw" };

    await expect(QadaDB.restoreCompletion((await latestCompletion()).id)).resolves.toBe(false);

    mockFault = null;
    expect(await QadaDB.getCompletions()).toHaveLength(1);
    expect(await batches()).toEqual([
      { id: batch.id, count: 2, status: QADA_ENTRY_STATUS.PENDING },
    ]);
    expect(await totals()).toEqual({ missed: 2, completed: 1 });
  });

  it("owes nothing again when the day was already gone", async () => {
    await QadaDB.addMissedFasts(3);
    const [batch] = await batches();
    await QadaDB.completeOneDayFromEntry(batch.id);
    mockFault = { match: new RegExp(`^DELETE FROM ${QADA_HISTORY_TABLE}`), kind: "noop" };

    await expect(QadaDB.restoreCompletion((await latestCompletion()).id)).resolves.toBe(false);

    mockFault = null;
    expect(await totals()).toEqual({ missed: 2, completed: 1 });
  });

  it("refuses a row that is not a recorded day", async () => {
    await QadaDB.addMissedFasts(2);
    const [batch] = await batches();

    await expect(QadaDB.restoreCompletion(batch.id)).resolves.toBe(false);
    expect(await totals()).toEqual({ missed: 2, completed: 0 });
  });
});
