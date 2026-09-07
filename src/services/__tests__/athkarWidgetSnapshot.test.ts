import { getWidgetSnapshotDataWith } from "@/services/athkar-db";

import type { SQLiteDatabase } from "expo-sqlite";

// athkar-db imports the location store, whose persistence opens a database at import.
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));

// One stub per SQL shape; the reader issues four queries and each is answered by text match.
const makeDb = (rows: {
  morning?: { completed: number | null; total: number };
  evening?: { completed: number | null; total: number };
  day?: { morning_completed_at: string | null; evening_completed_at: string | null } | null;
  streak?: { current_streak: number; longest_streak: number } | null;
}): SQLiteDatabase =>
  ({
    getFirstAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("athkar_daily_items")) {
        return params[1] === "%-morning" ? (rows.morning ?? null) : (rows.evening ?? null);
      }
      if (sql.includes("athkar_completed_days")) return rows.day ?? null;
      if (sql.includes("athkar_streak")) return rows.streak ?? null;
      throw new Error(`unexpected sql: ${sql}`);
    }),
  }) as unknown as SQLiteDatabase;

describe("getWidgetSnapshotDataWith", () => {
  test("reads both sessions, the completion stamps and the streak for one day", async () => {
    const db = makeDb({
      morning: { completed: 22, total: 22 },
      evening: { completed: 3, total: 22 },
      day: { morning_completed_at: "2026-09-06T04:10:00.000Z", evening_completed_at: null },
      streak: { current_streak: 5, longest_streak: 12 },
    });

    await expect(getWidgetSnapshotDataWith(db, 20260906)).resolves.toEqual({
      morning: { completed: 22, total: 22, completedAt: "2026-09-06T04:10:00.000Z" },
      evening: { completed: 3, total: 22, completedAt: null },
      streak: { current: 5, longest: 12 },
    });
  });

  test("a day with no rows reads as zero, not as an error", async () => {
    const db = makeDb({
      morning: { completed: null, total: 0 },
      evening: { completed: null, total: 0 },
    });

    await expect(getWidgetSnapshotDataWith(db, 20260906)).resolves.toEqual({
      morning: { completed: 0, total: 0, completedAt: null },
      evening: { completed: 0, total: 0, completedAt: null },
      streak: { current: 0, longest: 0 },
    });
  });

  test("passes the date and the session suffix as bound parameters", async () => {
    const db = makeDb({});
    await getWidgetSnapshotDataWith(db, 20260906);
    const calls = (db.getFirstAsync as jest.Mock).mock.calls as [string, unknown[]][];
    const items = calls.filter(([sql]) => sql.includes("athkar_daily_items")).map(([, p]) => p);
    expect(items).toEqual([
      [20260906, "%-morning"],
      [20260906, "%-evening"],
    ]);
  });
});
