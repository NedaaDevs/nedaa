import {
  CUSTOM_ATHKAR_DAILY_TABLE,
  CUSTOM_ATHKAR_GROUPS_TABLE,
  CUSTOM_ATHKAR_ITEMS_TABLE,
  MY_ATHKAR_DAILY_TABLE,
} from "@/constants/DB";
import { AthkarDB } from "@/services/athkar-db";

/** A statement the mock database fails. */
let mockFault: RegExp | null = null;

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
      const transaction = async (task: () => Promise<void>) => {
        db.exec("BEGIN");
        try {
          await task();
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      };
      return {
        execAsync: async (sql: string) => db.exec(sql),
        runAsync: async (sql: string, params: unknown[] = []) => {
          if (mockFault?.test(sql)) throw new Error("fault");
          const result = db.prepare(sql).run(...params);
          return {
            changes: Number(result.changes),
            lastInsertRowId: Number(result.lastInsertRowid),
          };
        },
        getAllAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).all(...params),
        getFirstAsync: async (sql: string, params: unknown[] = []) =>
          db.prepare(sql).get(...params) ?? null,
        withTransactionAsync: transaction,
        withExclusiveTransactionAsync: transaction,
        closeAsync: async () => db.close(),
      };
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

const DAY = 20261118;
const YESTERDAY = 20261117;
const FAULT = {
  INSERT_ITEM: new RegExp(`INSERT INTO ${CUSTOM_ATHKAR_ITEMS_TABLE}`),
  DELETE_GROUP: new RegExp(`DELETE FROM ${CUSTOM_ATHKAR_GROUPS_TABLE}`),
  DELETE_DAILY: new RegExp(`DELETE FROM ${CUSTOM_ATHKAR_DAILY_TABLE}`),
  DELETE_SAVED_DAILY: new RegExp(`DELETE FROM ${MY_ATHKAR_DAILY_TABLE}`),
} as const;

const DRAFTS = [
  { arabicText: "سبحان الله", userCount: 33 },
  { arabicText: "الحمد لله", userCount: 33 },
  { arabicText: "الله أكبر", userCount: 34 },
];

type Stored = { id: number; text: string; target: number; count: number | undefined };

/** The group's rows in order, each with its count on `day`. */
const storedRows = async (groupId: number, day = DAY): Promise<Stored[]> => {
  const [items, progress] = await Promise.all([
    AthkarDB.getCustomAthkarItems(),
    AthkarDB.getCustomAthkarDailyProgress(day),
  ]);
  return items
    .filter((item) => item.group_id === groupId)
    .map((item) => ({
      id: item.id,
      text: item.arabic_text,
      target: item.user_count,
      count: progress.find((p) => p.custom_item_id === item.id)?.current_count,
    }));
};

const totalOf = async (itemId: number, day = DAY) =>
  (await AthkarDB.getCustomAthkarDailyProgress(day)).find((p) => p.custom_item_id === itemId)
    ?.total_count;

/** A group of three, counted 5, 10 and 0 on DAY. */
const seedGroup = async (title: string) => {
  const groupId = await AthkarDB.createCustomAthkarGroup(title, DRAFTS);
  if (groupId === null) throw new Error("the group was not created");
  const items = (await AthkarDB.getCustomAthkarItems()).filter((i) => i.group_id === groupId);
  await AthkarDB.initializeCustomAthkarDaily(
    DAY,
    items.map((i) => ({ id: i.id, userCount: i.user_count }))
  );
  await AthkarDB.updateCustomAthkarDailyCount(DAY, items[0].id, 5);
  await AthkarDB.updateCustomAthkarDailyCount(DAY, items[1].id, 10);
  const rows = await storedRows(groupId);
  /** The stored rows as the editor hands them back. */
  const drafts = rows.map(({ id, text, target }) => ({ id, arabicText: text, userCount: target }));
  return { groupId, rows, drafts };
};

const groupTitle = async (groupId: number) =>
  (await AthkarDB.getCustomAthkarGroups()).find((g) => g.id === groupId)?.title;

beforeEach(() => {
  mockFault = null;
});

describe("AthkarDB.updateCustomAthkarGroup on SQLite", () => {
  it("keeps every row and today's counts when only the name changes", async () => {
    const { groupId, rows, drafts } = await seedGroup("before");

    await expect(AthkarDB.updateCustomAthkarGroup(groupId, "after", drafts, DAY)).resolves.toBe(
      true
    );

    expect(await groupTitle(groupId)).toBe("after");
    expect(await storedRows(groupId)).toEqual(rows);
  });

  it("keeps each row's id and count through a reorder", async () => {
    const { groupId, rows, drafts } = await seedGroup("reorder");

    await AthkarDB.updateCustomAthkarGroup(groupId, "reorder", [...drafts].reverse(), DAY);

    expect(await storedRows(groupId)).toEqual([...rows].reverse());
  });

  it("adds a new row at zero and keeps the others' counts", async () => {
    const { groupId, rows, drafts } = await seedGroup("added");
    const added = { arabicText: "لا إله إلا الله", userCount: 100 };

    await AthkarDB.updateCustomAthkarGroup(groupId, "added", [...drafts, added], DAY);

    const after = await storedRows(groupId);
    expect(after.slice(0, 3)).toEqual(rows);
    expect(after[3]).toMatchObject({ text: added.arabicText, target: added.userCount });
    expect(after[3].id).not.toBe(rows[2].id);
  });

  it("removes a row with all its counts and keeps the rest", async () => {
    const { groupId, rows, drafts } = await seedGroup("removed");
    const gone = rows[0].id;
    await AthkarDB.initializeCustomAthkarDaily(YESTERDAY, [{ id: gone, userCount: 33 }]);

    await AthkarDB.updateCustomAthkarGroup(groupId, "removed", drafts.slice(1), DAY);

    expect(await storedRows(groupId)).toEqual(rows.slice(1));
    expect(await totalOf(gone)).toBeUndefined();
    expect(await totalOf(gone, YESTERDAY)).toBeUndefined();
  });

  it("caps today's count at a target lowered below it", async () => {
    const { groupId, rows, drafts } = await seedGroup("lowered");

    await AthkarDB.updateCustomAthkarGroup(
      groupId,
      "lowered",
      [{ ...drafts[0], userCount: 3 }, ...drafts.slice(1)],
      DAY
    );

    const [first] = await storedRows(groupId);
    expect(first).toEqual({ ...rows[0], target: 3, count: 3 });
    expect(await totalOf(first.id)).toBe(3);
  });

  it("stores no count above the target, whenever the write lands", async () => {
    const { groupId, rows, drafts } = await seedGroup("late tap");
    await AthkarDB.updateCustomAthkarGroup(
      groupId,
      "late tap",
      [{ ...drafts[0], userCount: 3 }, ...drafts.slice(1)],
      DAY
    );

    await AthkarDB.updateCustomAthkarDailyCount(DAY, rows[0].id, 5);

    expect((await storedRows(groupId))[0].count).toBe(3);
  });

  it("changes nothing and says so when a statement fails", async () => {
    const { groupId, rows, drafts } = await seedGroup("fault");
    mockFault = FAULT.INSERT_ITEM;

    await expect(
      AthkarDB.updateCustomAthkarGroup(
        groupId,
        "renamed",
        [...drafts.slice(1), { arabicText: "جديد", userCount: 1 }],
        DAY
      )
    ).resolves.toBe(false);

    expect(await groupTitle(groupId)).toBe("fault");
    expect(await storedRows(groupId)).toEqual(rows);
  });

  it("refuses a row that belongs to another group", async () => {
    const mine = await seedGroup("mine");
    const theirs = await seedGroup("theirs");

    await expect(
      AthkarDB.updateCustomAthkarGroup(mine.groupId, "mine", theirs.drafts, DAY)
    ).resolves.toBe(false);

    expect(await storedRows(mine.groupId)).toEqual(mine.rows);
    expect(await storedRows(theirs.groupId)).toEqual(theirs.rows);
  });
});

describe("AthkarDB.deleteCustomAthkarGroup on SQLite", () => {
  it("deletes the group with its rows and counts", async () => {
    const { groupId, rows } = await seedGroup("deleted");

    await expect(AthkarDB.deleteCustomAthkarGroup(groupId)).resolves.toBe(true);

    expect(await groupTitle(groupId)).toBeUndefined();
    expect(await storedRows(groupId)).toEqual([]);
    expect(await totalOf(rows[0].id)).toBeUndefined();
  });

  it.each([FAULT.DELETE_GROUP, FAULT.DELETE_DAILY])(
    "keeps everything and says so when %s fails",
    async (fault) => {
      const { groupId, rows } = await seedGroup("kept");
      mockFault = fault;

      await expect(AthkarDB.deleteCustomAthkarGroup(groupId)).resolves.toBe(false);

      expect(await groupTitle(groupId)).toBe("kept");
      expect(await storedRows(groupId)).toEqual(rows);
    }
  );
});

describe("removing a saved Hisn dhikr", () => {
  const savedIds = async () => (await AthkarDB.getMyAthkar()).map((row) => row.id);

  test("removes it", async () => {
    const id = await AthkarDB.addToMyAthkar(10, 5, 3);
    if (id === null) throw new Error("the dhikr was not saved");

    await expect(AthkarDB.removeFromMyAthkar(id)).resolves.toBe(true);

    expect(await savedIds()).not.toContain(id);
  });

  test("keeps it and says so when its counts are not deleted", async () => {
    const id = await AthkarDB.addToMyAthkar(11, 5, 3);
    if (id === null) throw new Error("the dhikr was not saved");
    mockFault = FAULT.DELETE_SAVED_DAILY;

    await expect(AthkarDB.removeFromMyAthkar(id)).resolves.toBe(false);

    expect(await savedIds()).toContain(id);
  });
});
