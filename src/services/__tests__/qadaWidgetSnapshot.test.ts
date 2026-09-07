import { getCompletedCountBetweenWith } from "@/services/qada-db";

import type { SQLiteDatabase } from "expo-sqlite";

const makeDb = (total: number | null): SQLiteDatabase =>
  ({ getFirstAsync: jest.fn(async () => ({ total })) }) as unknown as SQLiteDatabase;

describe("getCompletedCountBetweenWith", () => {
  test("sums completed days inside the window", async () => {
    const db = makeDb(3);
    await expect(
      getCompletedCountBetweenWith(db, "2026-09-05T21:00:00.000Z", "2026-09-06T21:00:00.000Z")
    ).resolves.toBe(3);
    const [sql, params] = (db.getFirstAsync as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/type = 'completed'/);
    expect(params).toEqual(["2026-09-05T21:00:00.000Z", "2026-09-06T21:00:00.000Z"]);
  });

  test("an empty window reads as zero", async () => {
    await expect(getCompletedCountBetweenWith(makeDb(null), "a", "b")).resolves.toBe(0);
  });
});
