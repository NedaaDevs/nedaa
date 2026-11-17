const mockSync = jest.fn(async () => {});
jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: () => mockSync() }));

type CountWrite = [date: number, id: string, count: number, target: number];
const mockWriteCount = jest.fn<Promise<boolean>, CountWrite>(async () => true);
const mockSessionItems = jest.fn<Promise<unknown[]>, [number, string]>(async () => []);
const mockSessionCompleted = jest.fn(async () => false);
jest.mock("@/services/athkar-db", () => ({
  AthkarDB: {
    updateAthkarCount: (...write: CountWrite) => mockWriteCount(...write),
    initialize: jest.fn(async () => {}),
    initializeDailyItems: jest.fn(async () => true),
    getSessionItems: (date: number, session: string) => mockSessionItems(date, session),
    isSessionCompleted: () => mockSessionCompleted(),
    resetSessionCounts: jest.fn(async () => {}),
    checkAndMarkSessionComplete: jest.fn(async () => {}),
    areBothSessionsCompleted: jest.fn(async () => false),
    updateStreakForDay: jest.fn(async () => {}),
    getStreakData: jest.fn(async () => null),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { ADVANCE_PAUSE_MS, COUNT_WRITE_DELAY_MS } from "@/constants/AthkarSession";
import { useAthkarStore } from "@/stores/athkar";
import type { Athkar } from "@/types/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
/* eslint-enable import/first */

const dhikr = (order: number, count: number): Athkar => ({
  id: `${order}-${ATHKAR_TYPE.MORNING}`,
  title: `title.${order}`,
  text: `text.${order}`,
  count,
  type: ATHKAR_TYPE.MORNING,
  order,
});

const [first, second, third] = [dhikr(1, 1), dhikr(2, 3), dhikr(3, 1)];
const list = [first, second, third];

const state = () => useAthkarStore.getState();
const countOf = (item: Athkar) =>
  state().currentProgress.find((p) => p.athkarId === item.id)?.currentCount;
const tap = (item: Athkar) => state().incrementCount(item.id);
const pass = () => jest.advanceTimersByTime(ADVANCE_PAUSE_MS);

const RIYADH_NOON = {
  [20261116]: "2026-11-16T12:00:00+03:00",
  [20261117]: "2026-11-17T12:00:00+03:00",
};
const TODAY = 20261116;
const TOMORROW = 20261117;
const goToDay = (day: keyof typeof RIYADH_NOON) => jest.setSystemTime(new Date(RIYADH_NOON[day]));

/** Counts an item to its target and lets the move happen. */
const finish = (item: Athkar) => {
  for (let i = 0; i < item.count; i += 1) tap(item);
  pass();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  goToDay(TODAY);
  // A day's rows start at zero.
  mockSessionItems.mockImplementation(async (_date, session) =>
    session === ATHKAR_TYPE.MORNING
      ? list.map((a) => ({ thikr_id: a.id, current_count: 0, total_count: a.count }))
      : []
  );
  useAthkarStore.setState({
    progressDay: TODAY,
    morningAthkarList: list,
    eveningAthkarList: [],
    currentType: ATHKAR_TYPE.MORNING,
    currentAthkarIndex: 0,
    lastMorningIndex: 0,
    lastEveningIndex: 0,
    advancePending: false,
    playerState: PLAYER_STATE.IDLE,
    currentAthkarId: null,
    loadingAthkarId: null,
    settings: { autoMoveToNext: true, showStreak: true, showTranslation: true },
    currentProgress: list.map((a) => ({
      athkarId: a.id,
      currentCount: 0,
      totalCount: a.count,
      completed: false,
    })),
  });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("the pause before the next dhikr", () => {
  test("reaching the target moves to the next open dhikr after the pause", () => {
    tap(first);
    expect(state().advancePending).toBe(true);
    expect(state().currentAthkarIndex).toBe(0);
    pass();
    expect(state().advancePending).toBe(false);
    expect(state().currentAthkarIndex).toBe(1);
    expect(state().lastMorningIndex).toBe(1);
  });

  test("a count below the target starts no pause", () => {
    tap(second);
    expect(state().advancePending).toBe(false);
  });

  test("undo during the pause cancels the move", () => {
    tap(first);
    state().decrementCount(first.id);
    pass();
    expect(state().advancePending).toBe(false);
    expect(state().currentAthkarIndex).toBe(0);
    expect(countOf(first)).toBe(0);
  });

  test("a tap during the pause does not count", () => {
    tap(first);
    tap(second);
    state().incrementCountBy(second.id, 2);
    expect(countOf(second)).toBe(0);
  });

  test("hold-to-add does not count a dhikr whose audio is starting", () => {
    useAthkarStore.setState({ playerState: PLAYER_STATE.LOADING, loadingAthkarId: second.id });
    state().incrementCountBy(second.id, 2);
    expect(countOf(second)).toBe(0);
  });

  test("hold-to-add does not count the dhikr audio waits on", () => {
    useAthkarStore.setState({ playerState: PLAYER_STATE.LOADING, currentAthkarId: second.id });
    state().incrementCountBy(second.id, 2);
    expect(countOf(second)).toBe(0);
  });

  test("the audio count passes during the pause and starts none", () => {
    tap(first);
    state().incrementCount(second.id, true);
    expect(countOf(second)).toBe(1);
    pass();
    state().incrementCount(third.id, true);
    expect(state().advancePending).toBe(false);
  });

  test("the move skips a finished dhikr and wraps", () => {
    finish(first);
    state().jumpToIndex(2);
    finish(third);
    expect(state().currentAthkarIndex).toBe(1);
  });

  test("with auto-advance off the index stays", () => {
    useAthkarStore.setState({
      settings: { autoMoveToNext: false, showStreak: true, showTranslation: true },
    });
    tap(first);
    expect(state().advancePending).toBe(false);
    pass();
    expect(state().currentAthkarIndex).toBe(0);
  });

  test("the last open dhikr leaves the index in place", () => {
    finish(first);
    finish(second);
    finish(third);
    expect(state().currentAthkarIndex).toBe(2);
    expect(state().advancePending).toBe(false);
  });

  test("hold-to-add that reaches the target starts the pause", () => {
    state().incrementCountBy(second.id, 10);
    expect(countOf(second)).toBe(second.count);
    expect(state().advancePending).toBe(true);
  });
});

describe("jumping", () => {
  test("jumping to a finished dhikr keeps its full count", () => {
    finish(first);
    state().jumpToIndex(0);
    expect(state().currentAthkarIndex).toBe(0);
    expect(state().lastMorningIndex).toBe(0);
    expect(countOf(first)).toBe(first.count);
  });

  test("a jump outside the list changes nothing", () => {
    state().jumpToIndex(1);
    state().jumpToIndex(99);
    state().jumpToIndex(-1);
    state().jumpToIndex(1.5);
    expect(state().currentAthkarIndex).toBe(1);
  });

  test("a jump during the pause cancels the move", () => {
    tap(first);
    state().jumpToIndex(2);
    pass();
    expect(state().advancePending).toBe(false);
    expect(state().currentAthkarIndex).toBe(2);
  });

  test.each([
    ["next", () => state().moveToNext(), 1],
    ["previous", () => state().moveToPrevious(), 2],
  ])("moving to the %s dhikr during the pause cancels the move", (_name, move, index) => {
    tap(first);
    move();
    pass();
    expect(state().currentAthkarIndex).toBe(index);
  });
});

describe("reset", () => {
  test("a morning reset zeroes only the morning index", async () => {
    useAthkarStore.setState({ lastMorningIndex: 2, lastEveningIndex: 4 });
    await state().resetProgress();
    expect(state().lastMorningIndex).toBe(0);
    expect(state().lastEveningIndex).toBe(4);
  });

  test("an evening reset zeroes only the evening index", async () => {
    useAthkarStore.setState({
      currentType: ATHKAR_TYPE.EVENING,
      lastMorningIndex: 2,
      lastEveningIndex: 4,
    });
    await state().resetProgress();
    expect(state().lastMorningIndex).toBe(2);
    expect(state().lastEveningIndex).toBe(0);
  });

  test("a reset during the pause cancels the move and returns to the first dhikr", async () => {
    finish(first);
    finish(second);
    tap(third);
    await state().resetProgress();
    pass();
    expect(state().advancePending).toBe(false);
    expect(state().currentAthkarIndex).toBe(0);
    expect(countOf(third)).toBe(0);
  });
});

describe("count writes", () => {
  test("a count is written with its day and its target", async () => {
    tap(second);
    await state().flushCounts();
    expect(mockWriteCount.mock.calls).toEqual([[TODAY, second.id, 1, second.count]]);
  });

  test("leaving writes the pending count at once and refreshes the widget", async () => {
    tap(second);
    tap(second);
    expect(mockWriteCount).not.toHaveBeenCalled();
    await state().flushCounts();
    expect(mockWriteCount).toHaveBeenCalledTimes(1);
    expect(mockWriteCount).toHaveBeenLastCalledWith(TODAY, second.id, 2, second.count);
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  test("leaving with nothing pending writes nothing", async () => {
    await state().flushCounts();
    expect(mockWriteCount).not.toHaveBeenCalled();
    expect(mockSync).not.toHaveBeenCalled();
  });
});

describe("the day changes during a session", () => {
  const settle = () => jest.advanceTimersByTimeAsync(0);

  test("a tap after midnight counts on the new day from zero", async () => {
    tap(second);
    tap(second);
    goToDay(TOMORROW);
    tap(second);
    await settle();
    expect(state().progressDay).toBe(TOMORROW);
    expect(countOf(second)).toBe(1);
    await state().flushCounts();
    expect(mockWriteCount).toHaveBeenLastCalledWith(TOMORROW, second.id, 1, second.count);
  });

  test("the old day's pending count is written before the new day loads", async () => {
    tap(second);
    tap(second);
    goToDay(TOMORROW);
    mockSessionItems.mockImplementationOnce(async () => {
      expect(mockWriteCount.mock.calls).toEqual([[TODAY, second.id, 2, second.count]]);
      return [];
    });
    tap(second);
    await settle();
    expect(mockSessionItems).toHaveBeenCalledWith(TOMORROW, ATHKAR_TYPE.MORNING);
    expect.assertions(2);
  });

  test("taps that arrive while the new day loads all count on it", async () => {
    goToDay(TOMORROW);
    tap(second);
    tap(second);
    await settle();
    expect(countOf(second)).toBe(2);
    expect(mockSessionItems).toHaveBeenCalledTimes(2);
  });

  test("undo after midnight does not carry the old count over", async () => {
    tap(second);
    tap(second);
    goToDay(TOMORROW);
    state().decrementCount(second.id);
    await settle();
    expect(countOf(second)).toBe(0);
    await state().flushCounts();
    expect(mockWriteCount).toHaveBeenLastCalledWith(TOMORROW, second.id, 0, second.count);
  });

  test("the audio count after midnight is written on the new day", async () => {
    goToDay(TOMORROW);
    state().incrementCount(second.id, true);
    await settle();
    await state().flushCounts();
    expect(mockWriteCount.mock.calls).toEqual([[TOMORROW, second.id, 1, second.count]]);
  });

  test("a tap is dropped when the new day cannot load", async () => {
    goToDay(TOMORROW);
    mockSessionItems.mockRejectedValue(new Error("locked"));
    tap(second);
    await settle();
    await state().flushCounts();
    expect(mockWriteCount).not.toHaveBeenCalled();
  });
});

/** A DB that keeps each written count under its day and reads it back. */
const useStoredCounts = () => {
  const stored = new Map<string, number>();
  mockWriteCount.mockImplementation(async (date, id, count) => {
    stored.set(`${date}:${id}`, count);
    return true;
  });
  mockSessionItems.mockImplementation(async (date, session) =>
    session === ATHKAR_TYPE.MORNING
      ? list.map((a) => ({
          thikr_id: a.id,
          current_count: stored.get(`${date}:${a.id}`) ?? 0,
          total_count: a.count,
        }))
      : []
  );
};

describe("reloading the day's counts", () => {
  beforeEach(useStoredCounts);

  test("a reload keeps a count not yet written", async () => {
    tap(second);
    tap(second);
    await state().loadTodayProgress();
    expect(countOf(second)).toBe(2);
  });

  test("a count that arrives while the reload reads is kept", async () => {
    const read = mockSessionItems.getMockImplementation();
    mockSessionItems.mockImplementationOnce(async (date, session) => {
      tap(second);
      return (await read?.(date, session)) ?? [];
    });
    await state().loadTodayProgress();
    expect(countOf(second)).toBe(1);
  });

  test("a count that arrives after the rows are read is kept", async () => {
    mockSessionCompleted.mockImplementationOnce(async () => {
      tap(second);
      return false;
    });
    await state().loadTodayProgress();
    expect(countOf(second)).toBe(1);
  });

  test("a count written while the reload reads is kept", async () => {
    const read = mockSessionItems.getMockImplementation();
    mockSessionItems.mockImplementationOnce(async (date, session) => {
      const rows = (await read?.(date, session)) ?? [];
      tap(second);
      await jest.advanceTimersByTimeAsync(COUNT_WRITE_DELAY_MS);
      return rows;
    });
    await state().loadTodayProgress();
    expect(countOf(second)).toBe(1);
  });

  test("a reload waits for a write already under way", async () => {
    const write = mockWriteCount.getMockImplementation();
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockWriteCount.mockImplementationOnce(async (...args) => {
      await held;
      return (await write?.(...args)) ?? true;
    });
    tap(second);
    tap(third);
    await jest.advanceTimersByTimeAsync(COUNT_WRITE_DELAY_MS);
    const reload = state().loadTodayProgress();
    release();
    await reload;
    expect(countOf(third)).toBe(1);
  });

  test("a count the DB did not take stays, and the next write sends it", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockWriteCount.mockResolvedValueOnce(false);
    tap(second);
    await state().loadTodayProgress();
    expect(countOf(second)).toBe(1);

    await state().flushCounts();
    expect(mockWriteCount).toHaveBeenLastCalledWith(TODAY, second.id, 1, second.count);
  });
});

describe("the day changes with no tap", () => {
  beforeEach(useStoredCounts);

  test("the old day's counts are written under it, then the new day shows", async () => {
    tap(second);
    tap(second);
    goToDay(TOMORROW);
    await state().syncDay();
    expect(mockWriteCount.mock.calls).toEqual([[TODAY, second.id, 2, second.count]]);
    expect(state().progressDay).toBe(TOMORROW);
    expect(countOf(second)).toBe(0);
  });

  test("a count the old day could not write is sent beside the new day's", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    tap(second);
    mockWriteCount.mockResolvedValueOnce(false);
    goToDay(TOMORROW);
    await state().syncDay();
    mockWriteCount.mockClear();

    tap(second);
    await state().flushCounts();
    expect(mockWriteCount.mock.calls).toEqual(
      expect.arrayContaining([
        [TODAY, second.id, 1, second.count],
        [TOMORROW, second.id, 1, second.count],
      ])
    );
  });

  test("the same day reads and writes nothing", async () => {
    tap(second);
    await state().syncDay();
    expect(mockSessionItems).not.toHaveBeenCalled();
    expect(mockWriteCount).not.toHaveBeenCalled();
    expect(countOf(second)).toBe(1);
  });

  test("a new day that cannot load leaves no counts and writes none under it", async () => {
    tap(second);
    goToDay(TOMORROW);
    mockSessionItems.mockRejectedValue(new Error("locked"));
    await state().syncDay();
    expect(state().progressDay).toBeNull();
    expect(state().currentProgress).toEqual([]);
    tap(second);
    await state().flushCounts();
    expect(mockWriteCount.mock.calls).toEqual([[TODAY, second.id, 1, second.count]]);
  });

  test("a tap during the load counts once, on one load", async () => {
    goToDay(TOMORROW);
    const synced = state().syncDay();
    tap(second);
    await synced;
    await jest.advanceTimersByTimeAsync(0);
    expect(countOf(second)).toBe(1);
    // One read per period.
    expect(mockSessionItems).toHaveBeenCalledTimes(2);
  });

  test("the new day opens on its first dhikr", async () => {
    finish(first);
    finish(second);
    expect(state().lastMorningIndex).toBe(2);
    goToDay(TOMORROW);
    await state().syncDay();
    expect(state().currentAthkarIndex).toBe(0);
    expect(state().lastMorningIndex).toBe(0);
  });
});

describe("the Focus hint", () => {
  test("is seen once marked, and the mark is stored", () => {
    useAthkarStore.setState({ focusHintSeen: false });
    const stored = () =>
      useAthkarStore.persist.getOptions().partialize?.(useAthkarStore.getState());
    expect(stored()).toMatchObject({ focusHintSeen: false });
    useAthkarStore.getState().markFocusHintSeen();
    expect(stored()).toMatchObject({ focusHintSeen: true });
  });
});
