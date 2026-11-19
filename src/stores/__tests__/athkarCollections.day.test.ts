type DayWrite = [date: number, id: number, count: number];
const mockWriteHisn = jest.fn<Promise<boolean>, DayWrite>(async () => true);
const mockWriteCustom = jest.fn<Promise<boolean>, DayWrite>(async () => true);
/** The days whose rows exist, as the tables hold them: each starts at zero. */
const mockHisnDays = jest.fn<Promise<unknown[]>, [number]>(async () => []);
const mockCustomDays = jest.fn<Promise<unknown[]>, [number]>(async () => []);
jest.mock("@/services/athkar-db", () => ({
  AthkarDB: {
    getMyAthkar: jest.fn(async () => [
      { id: 1, source_athkar_id: 10, source_category_id: 5, user_count: 3, sort_order: 0 },
    ]),
    initializeMyAthkarDaily: jest.fn(async () => true),
    getMyAthkarDailyProgress: (date: number) => mockHisnDays(date),
    updateMyAthkarDailyCount: (...write: DayWrite) => mockWriteHisn(...write),
    getCustomAthkarGroups: jest.fn(async () => [{ id: 7, title: "group", sort_order: 0 }]),
    getCustomAthkarItems: jest.fn(async () => [
      { id: 1, group_id: 7, arabic_text: "text", user_count: 3, sort_order: 0 },
    ]),
    initializeCustomAthkarDaily: jest.fn(async () => true),
    getCustomAthkarDailyProgress: (date: number) => mockCustomDays(date),
    updateCustomAthkarDailyCount: (...write: DayWrite) => mockWriteCustom(...write),
  },
}));
jest.mock("@/services/hisn-muslim-db", () => ({
  HisnMuslimDB: {
    getAthkarByIds: jest.fn(async () => []),
    getCategoryForAthkar: jest.fn(async () => new Map()),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import { COUNT_WRITE_DELAY_MS } from "@/constants/AthkarSession";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useMyAthkarStore } from "@/stores/my-athkar";
/* eslint-enable import/first */

const ITEM = 1;
const TARGET = 3;
const RIYADH_NOON = {
  [20261116]: "2026-11-16T12:00:00+03:00",
  [20261117]: "2026-11-17T12:00:00+03:00",
};
const TODAY = 20261116;
const TOMORROW = 20261117;
const goToDay = (day: keyof typeof RIYADH_NOON) => jest.setSystemTime(new Date(RIYADH_NOON[day]));

const HISN_ROW = { my_athkar_id: ITEM, current_count: 0, total_count: TARGET };
const CUSTOM_ROW = { custom_item_id: ITEM, current_count: 0, total_count: TARGET };

const COLLECTIONS = [
  {
    name: "saved Hisn athkar",
    store: useMyAthkarStore,
    init: () => {
      useMyAthkarStore.setState({
        isInitialized: false,
        loadFailed: false,
        progress: [],
        progressDay: null,
      });
      return useMyAthkarStore.getState().initialize();
    },
    seed: () => mockHisnDays.mockImplementation(async () => [HISN_ROW]),
    writes: mockWriteHisn,
    days: mockHisnDays,
    countOf: () =>
      useMyAthkarStore.getState().progress.find((p) => p.myAthkarId === ITEM)?.currentCount,
  },
  {
    name: "custom athkar",
    store: useCustomAthkarStore,
    init: () => {
      useCustomAthkarStore.setState({
        isInitialized: false,
        loadFailed: false,
        progress: [],
        progressDay: null,
      });
      return useCustomAthkarStore.getState().initialize();
    },
    seed: () => mockCustomDays.mockImplementation(async () => [CUSTOM_ROW]),
    writes: mockWriteCustom,
    days: mockCustomDays,
    countOf: () =>
      useCustomAthkarStore.getState().progress.find((p) => p.customItemId === ITEM)?.currentCount,
  },
] as const;

describe.each(COLLECTIONS)("$name across days", ({ store, init, seed, writes, days, countOf }) => {
  const state = () => store.getState();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    goToDay(TODAY);
    seed();
    await init();
  });
  afterEach(() => jest.useRealTimers());

  test("the loaded counts are today's", () => {
    expect(state().progressDay).toBe(TODAY);
  });

  test("a count is written after taps settle, under its day", async () => {
    state().incrementCount(ITEM);
    expect(writes).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(COUNT_WRITE_DELAY_MS);
    expect(writes).toHaveBeenCalledWith(TODAY, ITEM, 1);
  });

  test("a flush writes a waiting count at once", async () => {
    state().incrementCount(ITEM);
    await state().flushCounts();
    expect(writes).toHaveBeenCalledWith(TODAY, ITEM, 1);
  });

  test("a count made before the new day loads belongs to the old day", async () => {
    goToDay(TOMORROW);
    state().incrementCount(ITEM);
    await state().flushCounts();
    expect(writes).toHaveBeenCalledWith(TODAY, ITEM, 1);
  });

  test("a new day writes the old day's counts, then opens at zero", async () => {
    state().incrementCount(ITEM);
    goToDay(TOMORROW);
    await state().syncDay();
    expect(writes).toHaveBeenCalledWith(TODAY, ITEM, 1);
    expect(days).toHaveBeenLastCalledWith(TOMORROW);
    expect(state().progressDay).toBe(TOMORROW);
    expect(countOf()).toBe(0);
  });

  test("callers arriving during one new-day load share it", async () => {
    goToDay(TOMORROW);
    days.mockClear();
    await Promise.all([state().syncDay(), state().syncDay()]);
    expect(days).toHaveBeenCalledTimes(1);
    expect(days).toHaveBeenCalledWith(TOMORROW);
  });

  test("a new day that fails to load writes the old day's counts, then drops them as failed", async () => {
    state().incrementCount(ITEM);
    goToDay(TOMORROW);
    days.mockRejectedValueOnce(new Error("offline"));
    await expect(state().syncDay()).resolves.toBeUndefined();
    expect(writes).toHaveBeenCalledWith(TODAY, ITEM, 1);
    expect(state()).toMatchObject({
      isInitialized: false,
      loadFailed: true,
      progress: [],
      progressDay: null,
    });
  });

  test("a retry after a failed new day loads the new day", async () => {
    state().incrementCount(ITEM);
    goToDay(TOMORROW);
    days.mockRejectedValueOnce(new Error("offline"));
    await state().syncDay();

    await state().initialize();
    expect(days).toHaveBeenLastCalledWith(TOMORROW);
    expect(state()).toMatchObject({
      isInitialized: true,
      loadFailed: false,
      progressDay: TOMORROW,
    });
    expect(countOf()).toBe(0);
  });

  test("the same day loads nothing again", async () => {
    state().incrementCount(ITEM);
    days.mockClear();
    await state().syncDay();
    expect(days).not.toHaveBeenCalled();
    expect(countOf()).toBe(1);
  });
});
