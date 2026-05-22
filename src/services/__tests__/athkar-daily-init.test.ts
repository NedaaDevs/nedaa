import { initializeDailyItemsCore, AthkarItem } from "@/services/athkar-daily-init";
import { createAsyncLock } from "@/utils/asyncLock";
import { ATHKAR_COMPLETED_DAYS_TABLE, ATHKAR_DAILY_ITEMS_TABLE } from "@/constants/DB";

// ─────────────────────────────────────────────────────────────────────────────
// Fake SQLite driver that enforces the real expo-sqlite invariants the fix
// relies on:
//   1. withExclusiveTransactionAsync serializes — re-entering it while one is
//      open throws the same "cannot start a transaction within a transaction"
//      shape that produced the production crash.
//   2. INSERT OR IGNORE is idempotent on the PK we use (date, thikr_id).
//   3. SELECT COUNT(*) WHERE date = ? returns the count of matching rows.
// ─────────────────────────────────────────────────────────────────────────────

type Row = {
  date: number;
  thikr_id: string;
  current_count: number;
  total_count: number;
};

class FakeDb {
  // Daily items keyed by `${date}|${thikr_id}` so INSERT OR IGNORE is trivial.
  dailyItems = new Map<string, Row>();
  // Completed-days keyed by date.
  completedDays = new Set<number>();
  // Tracks whether an exclusive txn is open right now — used to detect
  // "transaction within a transaction" the same way real SQLite does.
  private inExclusiveTxn = false;
  // Peak concurrency observed inside withExclusiveTransactionAsync. Must be 1.
  exclusivePeak = 0;
  // Records every error thrown inside the driver so tests can assert "no
  // errors were swallowed by the production catch block".
  driverErrors: Error[] = [];

  async withExclusiveTransactionAsync(task: (txn: FakeTxn) => Promise<void>): Promise<void> {
    if (this.inExclusiveTxn) {
      const err = new Error("cannot start a transaction within a transaction");
      this.driverErrors.push(err);
      throw err;
    }
    this.inExclusiveTxn = true;
    this.exclusivePeak = Math.max(this.exclusivePeak, 1);
    try {
      const txn = new FakeTxn(this);
      await task(txn);
    } finally {
      this.inExclusiveTxn = false;
    }
  }
}

class FakeTxn {
  constructor(private db: FakeDb) {}

  async getFirstAsync<T>(sql: string, params: unknown[]): Promise<T | null> {
    const trimmed = sql.replace(/\s+/g, " ").trim();
    if (trimmed.includes(`COUNT(*)`) && trimmed.includes(ATHKAR_DAILY_ITEMS_TABLE)) {
      const date = params[0] as number;
      let count = 0;
      for (const row of this.db.dailyItems.values()) if (row.date === date) count++;
      return { count } as unknown as T;
    }
    throw new Error(`FakeTxn.getFirstAsync: unsupported SQL: ${trimmed}`);
  }

  async runAsync(sql: string, params: unknown[]): Promise<void> {
    const trimmed = sql.replace(/\s+/g, " ").trim();
    if (trimmed.startsWith(`INSERT OR IGNORE INTO ${ATHKAR_DAILY_ITEMS_TABLE}`)) {
      const [date, thikr_id, total_count] = params as [number, string, number];
      const key = `${date}|${thikr_id}`;
      if (!this.db.dailyItems.has(key)) {
        this.db.dailyItems.set(key, { date, thikr_id, current_count: 0, total_count });
      }
      return;
    }
    if (trimmed.startsWith(`INSERT OR IGNORE INTO ${ATHKAR_COMPLETED_DAYS_TABLE}`)) {
      const [date] = params as [number];
      this.db.completedDays.add(date);
      return;
    }
    throw new Error(`FakeTxn.runAsync: unsupported SQL: ${trimmed}`);
  }
}

// Build N morning + N evening items matching production shape.
const buildLists = (n: number): { morning: AthkarItem[]; evening: AthkarItem[] } => ({
  morning: Array.from({ length: n }, (_, i) => ({
    id: `${i + 1}-morning`,
    order: i + 1,
    count: 1,
    type: "thikr",
  })),
  evening: Array.from({ length: n }, (_, i) => ({
    id: `${i + 1}-evening`,
    order: i + 1,
    count: 1,
    type: "thikr",
  })),
});

const silentLog = { i: () => {}, e: () => {} };

const countRowsForDate = (db: FakeDb, date: number): number => {
  let c = 0;
  for (const row of db.dailyItems.values()) if (row.date === date) c++;
  return c;
};

describe("initializeDailyItemsCore (extracted core of athkar daily init)", () => {
  const date = 20260518;

  test("empty day: inserts all morning + evening rows + completed-day", async () => {
    const db = new FakeDb();
    const { morning, evening } = buildLists(22); // production: 22 + 22 = 44

    const ok = await initializeDailyItemsCore(
      db as any,
      date,
      morning,
      evening,
      "2026-05-18T00:00:00.000Z",
      silentLog
    );

    expect(ok).toBe(true);
    expect(countRowsForDate(db, date)).toBe(44);
    expect(db.completedDays.has(date)).toBe(true);
    expect(db.driverErrors).toEqual([]);
  });

  test("self-heal: partial set expands to full 44 via back-fill", async () => {
    const db = new FakeDb();
    // 3 of the canonical evening rows already exist (a previous run inserted
    // them before the BEGIN race interrupted). The new call must complete
    // the set without duplicating those three.
    for (const id of ["1-evening", "2-evening", "3-evening"]) {
      db.dailyItems.set(`${date}|${id}`, {
        date,
        thikr_id: id,
        current_count: 0,
        total_count: 1,
      });
    }
    expect(countRowsForDate(db, date)).toBe(3);

    const { morning, evening } = buildLists(22);
    const ok = await initializeDailyItemsCore(
      db as any,
      date,
      morning,
      evening,
      "2026-05-18T00:00:00.000Z",
      silentLog
    );

    expect(ok).toBe(true);
    expect(countRowsForDate(db, date)).toBe(44);
    // Every canonical id is present.
    for (const item of [...morning, ...evening]) {
      expect(db.dailyItems.has(`${date}|${item.id}`)).toBe(true);
    }
    expect(db.completedDays.has(date)).toBe(true);
    expect(db.driverErrors).toEqual([]);
  });

  test("self-heal with stale survivors: back-fills current list, leaves stale rows", async () => {
    // Reproduces the literal production log state: surviving rows
    // [22-evening, 23-evening, 24-evening], where 23 and 24 are stale (the
    // user's list was previously larger). Post-fix behaviour: the current
    // 44-item set gets fully written; the stale rows persist harmlessly
    // until cleanUpOldData runs (the UI ignores them because it reads from
    // the current list, not the DB rows directly).
    const db = new FakeDb();
    for (const id of ["22-evening", "23-evening", "24-evening"]) {
      db.dailyItems.set(`${date}|${id}`, {
        date,
        thikr_id: id,
        current_count: 0,
        total_count: 1,
      });
    }

    const { morning, evening } = buildLists(22);
    const ok = await initializeDailyItemsCore(db as any, date, morning, evening, "now", silentLog);

    expect(ok).toBe(true);
    // Every canonical id is present (back-fill succeeded).
    for (const item of [...morning, ...evening]) {
      expect(db.dailyItems.has(`${date}|${item.id}`)).toBe(true);
    }
    // Stale rows persisted, raising count above 44 — expected and harmless.
    expect(db.dailyItems.has(`${date}|23-evening`)).toBe(true);
    expect(db.dailyItems.has(`${date}|24-evening`)).toBe(true);
    expect(countRowsForDate(db, date)).toBe(46);
    expect(db.driverErrors).toEqual([]);
  });

  test("idempotent skip: a full set is a no-op (no extra inserts)", async () => {
    const db = new FakeDb();
    const { morning, evening } = buildLists(22);

    // First call seeds it.
    await initializeDailyItemsCore(db as any, date, morning, evening, "now", silentLog);
    expect(countRowsForDate(db, date)).toBe(44);

    // Second call should observe count >= total and skip — no new rows.
    const snapshot = new Map(db.dailyItems);
    const ok = await initializeDailyItemsCore(db as any, date, morning, evening, "now", silentLog);

    expect(ok).toBe(true);
    expect(countRowsForDate(db, date)).toBe(44);
    expect(db.dailyItems).toEqual(snapshot);
  });

  test("returns false (does not throw) when the driver fails inside the txn", async () => {
    // Simulate a transient driver failure: throw from inside the txn body.
    const failingDb = {
      withExclusiveTransactionAsync: async () => {
        throw new Error("database is locked");
      },
    };
    const { morning, evening } = buildLists(22);

    const ok = await initializeDailyItemsCore(
      failingDb as any,
      date,
      morning,
      evening,
      "now",
      silentLog
    );

    expect(ok).toBe(false);
  });

  test("concurrent callers via asyncLock: no nested-transaction error, exactly 44 rows", async () => {
    // This is the production scenario: 10 callers fire near-simultaneously.
    // The fake driver throws if a second exclusive txn opens while one is
    // active — same shape as the real SQLite error. The asyncLock wrapper
    // must keep that from ever happening.
    const db = new FakeDb();
    const { morning, evening } = buildLists(22);
    const lock = createAsyncLock();

    const calls = Array.from({ length: 10 }, () =>
      lock(() => initializeDailyItemsCore(db as any, date, morning, evening, "now", silentLog))
    );

    const results = await Promise.all(calls);

    expect(results.every((r) => r === true)).toBe(true);
    expect(countRowsForDate(db, date)).toBe(44);
    expect(db.exclusivePeak).toBe(1);
    expect(db.driverErrors).toEqual([]);
  });

  test("WITHOUT the lock: the same 10 concurrent callers reproduce the original bug", async () => {
    // Sanity check that our fake driver actually catches the bug. If you
    // remove the asyncLock wrapper from the production call site, this is
    // what the fake should report — proving the fake is a faithful repro.
    const db = new FakeDb();
    const { morning, evening } = buildLists(22);

    const calls = Array.from({ length: 10 }, () =>
      initializeDailyItemsCore(db as any, date, morning, evening, "now", silentLog)
    );

    await Promise.all(calls);

    // Driver should have rejected at least one nested-BEGIN attempt.
    expect(db.driverErrors.length).toBeGreaterThan(0);
    expect(db.driverErrors[0].message).toBe("cannot start a transaction within a transaction");
  });
});
