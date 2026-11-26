import { ADVANCE_PAUSE_MS, MARK_SIZE, MARK_STATE } from "@/constants/AthkarSession";
import {
  ATHKAR_GROUP_ORDER,
  ATHKAR_GROUP_ORDERS,
  ATHKAR_TYPE,
  DEFAULT_ATHKAR_GROUP_ORDER,
  type AthkarGroupOrder,
} from "@/constants/Athkar";
import type { Athkar } from "@/types/athkar";
import {
  createAdvance,
  nextOpenIndex,
  positionMarks,
  textAt,
  textIndexAt,
  textTurnAt,
  toCounts,
  toSessionItems,
  type SessionItem,
} from "@/utils/athkarSession";
import { keyText } from "@/utils/athkarText";

const plain = (id: string, target: number): SessionItem => ({
  id,
  target,
  texts: [keyText("t")],
  itemsPerRound: 1,
  groupOrder: DEFAULT_ATHKAR_GROUP_ORDER,
});
const group = (
  target: number,
  groupOrder: AthkarGroupOrder = DEFAULT_ATHKAR_GROUP_ORDER
): SessionItem => ({
  id: "2",
  target,
  texts: ["a", "b", "c"].map(keyText),
  itemsPerRound: 3,
  groupOrder,
});
const quls = group(9);
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
    expect(toSessionItems([dhikr({})], DEFAULT_ATHKAR_GROUP_ORDER)).toEqual([
      {
        id: "1-morning",
        target: 3,
        texts: [keyText("text.key")],
        itemsPerRound: 1,
        groupOrder: DEFAULT_ATHKAR_GROUP_ORDER,
      },
    ]);
  });

  test.each(ATHKAR_GROUP_ORDERS)(
    "a grouped dhikr carries its texts, round size and %s",
    (order) => {
      const info = { texts: ["a", "b", "c"], audioIds: ["x", "y", "z"], itemsPerRound: 3 };
      expect(toSessionItems([dhikr({ count: 9, group: info })], order)[0]).toMatchObject({
        target: 9,
        texts: ["a", "b", "c"].map(keyText),
        itemsPerRound: 3,
        groupOrder: order,
      });
    }
  );
});

test("toCounts keys each count by its dhikr", () => {
  expect(toCounts([{ athkarId: "a", currentCount: 2, totalCount: 3, completed: false }])).toEqual({
    a: 2,
  });
});

describe("textAt", () => {
  test("names the text a count has reached by its dhikr and its turn", () => {
    expect(textAt(quls, { "2": 4 })).toEqual({ id: "2:1", text: keyText("b") });
  });

  test("each in full, a count shows the text whose repeats it is in", () => {
    const full = group(9, ATHKAR_GROUP_ORDER.EACH_IN_FULL);
    expect(textAt(full, { "2": 4 })).toEqual({ id: "2:1", text: keyText("b") });
    expect(textAt(full, { "2": 2 })).toEqual({ id: "2:0", text: keyText("a") });
  });

  test("two dhikr with the same words keep their own names", () => {
    expect(textAt(plain("a", 3), {}).id).not.toBe(textAt(plain("b", 3), {}).id);
  });
});

describe("textIndexAt", () => {
  const COUNTS = Array.from({ length: 10 }, (_, count) => count);
  // Counts 0 to 9 of three texts over three rounds; 9 is the finished group.
  const NINE: Record<AthkarGroupOrder, number[]> = {
    [ATHKAR_GROUP_ORDER.BY_ROUND]: [0, 1, 2, 0, 1, 2, 0, 1, 2, 2],
    [ATHKAR_GROUP_ORDER.EACH_IN_FULL]: [0, 0, 0, 1, 1, 1, 2, 2, 2, 2],
  };

  test.each(ATHKAR_GROUP_ORDERS)("three texts over three rounds, %s", (order) => {
    expect(COUNTS.map((count) => textIndexAt(group(9, order), count))).toEqual(NINE[order]);
  });

  // Four counts over three texts: the first text takes the extra count.
  const FOUR: Record<AthkarGroupOrder, number[]> = {
    [ATHKAR_GROUP_ORDER.BY_ROUND]: [0, 1, 2, 0, 0, 0],
    [ATHKAR_GROUP_ORDER.EACH_IN_FULL]: [0, 0, 1, 2, 2, 2],
  };

  test.each(ATHKAR_GROUP_ORDERS)("a target that is no multiple of the texts, %s", (order) => {
    expect([0, 1, 2, 3, 4, 5].map((count) => textIndexAt(group(4, order), count))).toEqual(
      FOUR[order]
    );
  });

  test.each([1, 2, 4, 5, 9, 10, 11, 33])(
    "both orders show each text as often, over a target of %i",
    (target) => {
      const shown = (order: AthkarGroupOrder) =>
        Array.from({ length: target }, (_, count) => textIndexAt(group(target, order), count))
          .sort()
          .join();
      expect(shown(ATHKAR_GROUP_ORDER.EACH_IN_FULL)).toBe(shown(ATHKAR_GROUP_ORDER.BY_ROUND));
    }
  );

  test.each([1, 2, 4, 5, 9, 10, 11, 33])(
    "each in full shows each text in one run, over a target of %i",
    (target) => {
      const shown = Array.from({ length: target }, (_, count) =>
        textIndexAt(group(target, ATHKAR_GROUP_ORDER.EACH_IN_FULL), count)
      );
      expect([...shown].sort()).toEqual(shown);
    }
  );

  test.each(ATHKAR_GROUP_ORDERS)("a plain dhikr always shows its one text, %s", (order) => {
    const one = { ...plain("a", 3), groupOrder: order };
    expect([0, 1, 3].map((count) => textIndexAt(one, count))).toEqual([0, 0, 0]);
  });
});

describe("textTurnAt", () => {
  const turns = (item: SessionItem) =>
    Array.from({ length: item.target + 1 }, (_, count) => {
      const { turn, of } = textTurnAt(item, count);
      return `${turn}/${of}`;
    });

  test("by round, the turn is the round", () => {
    expect(turns(group(9, ATHKAR_GROUP_ORDER.BY_ROUND))).toEqual([
      ...["1/3", "1/3", "1/3", "2/3", "2/3", "2/3", "3/3", "3/3", "3/3"],
      "3/3",
    ]);
  });

  test("each in full, the turn is the repeat of the text shown", () => {
    expect(turns(group(9, ATHKAR_GROUP_ORDER.EACH_IN_FULL))).toEqual([
      ...["1/3", "2/3", "3/3", "1/3", "2/3", "3/3", "1/3", "2/3", "3/3"],
      "3/3",
    ]);
  });

  test("each in full, a text with the extra count has one turn more", () => {
    expect(turns(group(4, ATHKAR_GROUP_ORDER.EACH_IN_FULL))).toEqual([
      "1/2",
      "2/2",
      "1/1",
      "1/1",
      "1/1",
    ]);
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

describe("createAdvance", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("the move waits for the pause, then happens once", () => {
    const move = jest.fn();
    createAdvance().start(move);
    jest.advanceTimersByTime(ADVANCE_PAUSE_MS - 1);
    expect(move).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(move).toHaveBeenCalledTimes(1);
  });

  test("a cancelled move never happens", () => {
    const move = jest.fn();
    const advance = createAdvance();
    advance.start(move);
    advance.cancel();
    jest.advanceTimersByTime(ADVANCE_PAUSE_MS);
    expect(move).not.toHaveBeenCalled();
  });

  test("a second start replaces the first", () => {
    const [first, second] = [jest.fn(), jest.fn()];
    const advance = createAdvance();
    advance.start(first);
    advance.start(second);
    jest.advanceTimersByTime(ADVANCE_PAUSE_MS);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
