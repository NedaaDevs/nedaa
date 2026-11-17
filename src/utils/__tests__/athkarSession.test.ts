import { MARK_SIZE, MARK_STATE } from "@/constants/AthkarSession";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import type { Athkar } from "@/types/athkar";
import {
  nextOpenIndex,
  positionMarks,
  textIndexAt,
  toCounts,
  toSessionItems,
  type SessionItem,
} from "@/utils/athkarSession";

const plain = (id: string, target: number): SessionItem => ({
  id,
  target,
  textKeys: ["t"],
  itemsPerRound: 1,
});
const quls: SessionItem = { id: "2", target: 9, textKeys: ["a", "b", "c"], itemsPerRound: 3 };
const many = (length: number) => Array.from({ length }, (_, i) => plain(String(i), 1));

describe("toSessionItems", () => {
  const dhikr = (over: Partial<Athkar>): Athkar => ({
    id: "1-morning",
    title: "title",
    text: "text.key",
    count: 3,
    type: ATHKAR_TYPE.MORNING,
    order: 1,
    ...over,
  });

  test("a plain dhikr has one text and rounds of one", () => {
    expect(toSessionItems([dhikr({})])).toEqual([
      { id: "1-morning", target: 3, textKeys: ["text.key"], itemsPerRound: 1 },
    ]);
  });

  test("a grouped dhikr carries its texts and its round size", () => {
    const group = { texts: ["a", "b", "c"], audioIds: ["x", "y", "z"], itemsPerRound: 3 };
    expect(toSessionItems([dhikr({ count: 9, group })])[0]).toMatchObject({
      target: 9,
      textKeys: ["a", "b", "c"],
      itemsPerRound: 3,
    });
  });
});

test("toCounts keys each count by its dhikr", () => {
  expect(toCounts([{ athkarId: "a", currentCount: 2, totalCount: 3, completed: false }])).toEqual({
    a: 2,
  });
});

describe("textIndexAt", () => {
  test("a group shows texts in rounds and ends on its last text", () => {
    expect([0, 1, 2, 3, 8, 9].map((count) => textIndexAt(quls, count))).toEqual([0, 1, 2, 0, 2, 2]);
  });

  test("a plain dhikr always shows its one text", () => {
    expect([0, 1, 3].map((count) => textIndexAt(plain("a", 3), count))).toEqual([0, 0, 0]);
  });
});

describe("nextOpenIndex", () => {
  const items = [plain("a", 1), plain("b", 1), plain("c", 1)];

  test("skips finished items and wraps", () => {
    expect(nextOpenIndex(items, { a: 0, b: 1, c: 1 }, 2)).toBe(0);
  });

  test("takes the next item when it is open", () => {
    expect(nextOpenIndex(items, { a: 1 }, 0)).toBe(1);
  });

  test("is null when nothing is open", () => {
    expect(nextOpenIndex(items, { a: 1, b: 1, c: 1 }, 0)).toBeNull();
  });

  test("never returns the item it starts from", () => {
    expect(nextOpenIndex(items, { a: 0, b: 1, c: 1 }, 0)).toBeNull();
  });
});

describe("positionMarks", () => {
  const fullAt = (total: number, index: number | null) =>
    positionMarks(many(total), {}, index).flatMap((mark, i) =>
      mark.size === MARK_SIZE.FULL ? [i] : []
    );

  test("twelve items draw twelve full marks", () => {
    expect(fullAt(12, 5)).toHaveLength(12);
  });

  test.each([
    [0, 0],
    [3, 0],
    [9, 6],
    [17, 11],
  ])("eighteen items at index %i keep seven full marks from %i", (index, start) => {
    expect(fullAt(18, index)).toEqual(Array.from({ length: 7 }, (_, i) => start + i));
  });

  test("marks say done, current and remaining", () => {
    const items = [plain("a", 1), plain("b", 2), plain("c", 1)];
    expect(positionMarks(items, { a: 1, b: 1 }, 1).map((mark) => mark.state)).toEqual([
      MARK_STATE.DONE,
      MARK_STATE.CURRENT,
      MARK_STATE.REMAINING,
    ]);
  });

  test("a finished session has no current mark", () => {
    expect(positionMarks([plain("a", 1)], { a: 1 }, null)).toEqual([
      { id: "a", state: MARK_STATE.DONE, size: MARK_SIZE.FULL },
    ]);
  });

  test("a long finished session keeps its first seven marks full", () => {
    expect(fullAt(18, null)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
