import { groupMyAthkarByCategory } from "@/stores/my-athkar";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const item = (id: number, sourceAthkarId: number, sourceCategoryId: number) =>
  ({ id, sourceAthkarId, sourceCategoryId }) as never;

const display = (entries: [number, { categoryTitleAr: string; categoryTitleEn: string }][]) =>
  new Map(entries) as never;

describe("groupMyAthkarByCategory", () => {
  test("groups items sharing a category", () => {
    const groups = groupMyAthkarByCategory(
      [item(1, 10, 100), item(2, 11, 100)],
      display([
        [10, { categoryTitleAr: "صباح", categoryTitleEn: "Morning" }],
        [11, { categoryTitleAr: "صباح", categoryTitleEn: "Morning" }],
      ])
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].titleEn).toBe("Morning");
  });

  test("keeps separate categories apart", () => {
    const groups = groupMyAthkarByCategory(
      [item(1, 10, 100), item(2, 20, 200)],
      display([
        [10, { categoryTitleAr: "صباح", categoryTitleEn: "Morning" }],
        [20, { categoryTitleAr: "مساء", categoryTitleEn: "Evening" }],
      ])
    );

    expect(groups.map((group) => group.categoryId)).toEqual([100, 200]);
  });

  test("skips items with no display entry", () => {
    const groups = groupMyAthkarByCategory([item(1, 10, 100)], display([]));

    expect(groups).toEqual([]);
  });

  test("returns a fresh array, so callers must memoize it", () => {
    const args = [
      [item(1, 10, 100)],
      display([[10, { categoryTitleAr: "ص", categoryTitleEn: "M" }]]),
    ] as const;

    expect(groupMyAthkarByCategory(...args)).not.toBe(groupMyAthkarByCategory(...args));
  });
});
