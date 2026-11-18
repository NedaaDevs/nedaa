import { AppState, AppStateStatus } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

/** A count write: its day first, then the dhikr, its count and any more the table takes. */
type CountWrite = [date: number, id: unknown, count: number, ...rest: unknown[]];
const mockWriteDaily = jest.fn<Promise<boolean>, CountWrite>(async () => true);
const mockWriteHisn = jest.fn<Promise<boolean>, CountWrite>(async () => true);
const mockWriteCustom = jest.fn<Promise<boolean>, CountWrite>(async () => true);
/** A day's rows, as each table holds them when the day is read. */
const mockDailyRows = jest.fn<Promise<unknown[]>, [number, string]>(async () => []);
const mockHisnRows = jest.fn<Promise<unknown[]>, [number]>(async () => []);
const mockCustomRows = jest.fn<Promise<unknown[]>, [number]>(async () => []);
jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: jest.fn(async () => {}) }));
jest.mock("@/services/athkar-db", () => ({
  AthkarDB: {
    initialize: jest.fn(async () => {}),
    updateAthkarCount: (...write: CountWrite) => mockWriteDaily(...write),
    updateMyAthkarDailyCount: (...write: CountWrite) => mockWriteHisn(...write),
    updateCustomAthkarDailyCount: (...write: CountWrite) => mockWriteCustom(...write),
    initializeDailyItems: jest.fn(async () => true),
    getSessionItems: (date: number, session: string) => mockDailyRows(date, session),
    isSessionCompleted: jest.fn(async () => false),
    initializeMyAthkarDaily: jest.fn(async () => true),
    getMyAthkarDailyProgress: (date: number) => mockHisnRows(date),
    initializeCustomAthkarDaily: jest.fn(async () => true),
    getCustomAthkarDailyProgress: (date: number) => mockCustomRows(date),
    checkAndMarkSessionComplete: jest.fn(async () => {}),
    areBothSessionsCompleted: jest.fn(async () => false),
    updateStreakForDay: jest.fn(async () => {}),
    getStreakData: jest.fn(async () => null),
  },
}));
jest.mock("@/services/hisn-muslim-db", () => ({ HisnMuslimDB: {} }));
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
import { APP_STATE } from "@/constants/AppState";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { STEP } from "@/constants/AthkarFocus";
import { ADVANCE_PAUSE_MS, COUNT_WRITE_DELAY_MS, SESSION_STATUS } from "@/constants/AthkarSession";
import { useAthkarSession } from "@/hooks/useAthkarSession";
import {
  useCustomOpening,
  useCustomPort,
  useDailyPort,
  useHisnOpening,
  useHisnPort,
  useSessionOpening,
} from "@/hooks/useAthkarSessionPort";
import { useAthkarStore } from "@/stores/athkar";
import { useAthkarCollectionSession } from "@/stores/athkarCollectionSession";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useMyAthkarStore } from "@/stores/my-athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
/* eslint-enable import/first */

/** Every source holds the same session: three dhikr with these targets. */
const TARGETS = [1, 3, 1] as const;
const [A, B, C] = [0, 1, 2];
const CATEGORY = 5;
const GROUP = 7;
const dailyId = (index: number) => `${index + 1}-${ATHKAR_TYPE.MORNING}`;

const RIYADH_NOON = {
  [20261116]: "2026-11-16T12:00:00+03:00",
  [20261117]: "2026-11-17T12:00:00+03:00",
};
const TODAY = 20261116;
const TOMORROW = 20261117;
const goToDay = (day: keyof typeof RIYADH_NOON) => jest.setSystemTime(new Date(RIYADH_NOON[day]));

type Seed = { counts?: readonly number[]; autoMoveToNext?: boolean };

const seedSettings = (autoMoveToNext: boolean) =>
  useAthkarStore.setState({
    advancePending: false,
    playerState: PLAYER_STATE.IDLE,
    currentAthkarId: null,
    loadingAthkarId: null,
    settings: { autoMoveToNext, showStreak: true, showTranslation: true, look: null },
  });

const progressOf = (counts: readonly number[]) =>
  TARGETS.map((totalCount, i) => ({
    currentCount: counts[i] ?? 0,
    totalCount,
    completed: (counts[i] ?? 0) >= totalCount,
  }));

const SOURCES = [
  {
    name: "morning athkar",
    writes: mockWriteDaily,
    seed: (counts: readonly number[]) => {
      const list = TARGETS.map((count, i) => ({
        id: dailyId(i),
        title: `title.${i}`,
        text: `text.${i}`,
        count,
        type: ATHKAR_TYPE.MORNING,
        order: i + 1,
      }));
      useAthkarStore.setState({
        morningAthkarList: list,
        eveningAthkarList: [],
        currentType: ATHKAR_TYPE.MORNING,
        currentAthkarIndex: 0,
        lastMorningIndex: 0,
        lastEveningIndex: 0,
        progressDay: TODAY,
        currentProgress: progressOf(counts).map((p, i) => ({ ...p, athkarId: list[i].id })),
      });
    },
    useSession: () => {
      useSessionOpening();
      return useAthkarSession(useDailyPort());
    },
  },
  {
    name: "a saved Hisn topic",
    writes: mockWriteHisn,
    seed: (counts: readonly number[]) => {
      const items = TARGETS.map((userCount, i) => ({
        id: i + 1,
        sourceAthkarId: 100 + i,
        sourceCategoryId: CATEGORY,
        userCount,
        sortOrder: i,
      }));
      useMyAthkarStore.setState({
        isInitialized: true,
        progressDay: TODAY,
        items,
        displayData: new Map(
          items.map((item) => [
            item.sourceAthkarId,
            {
              id: item.sourceAthkarId,
              categoryId: CATEGORY,
              arabicText: `dhikr ${item.id}`,
              transliteration: "",
              translation: "",
              repeatCount: item.userCount,
              audioUrl: null,
              sortOrder: item.sortOrder,
              categoryTitleAr: "topic",
              categoryTitleEn: "topic",
            },
          ])
        ),
        progress: progressOf(counts).map((p, i) => ({ ...p, myAthkarId: items[i].id })),
      });
    },
    useSession: () => {
      const port = useHisnPort(CATEGORY);
      useHisnOpening(CATEGORY, port.ready);
      return useAthkarSession(port);
    },
  },
  {
    name: "a custom group",
    writes: mockWriteCustom,
    seed: (counts: readonly number[]) => {
      const items = TARGETS.map((userCount, i) => ({
        id: i + 1,
        groupId: GROUP,
        arabicText: `dhikr ${i + 1}`,
        userCount,
        sortOrder: i,
      }));
      useCustomAthkarStore.setState({
        isInitialized: true,
        progressDay: TODAY,
        groups: [{ id: GROUP, title: "group", sortOrder: 0 }],
        items,
        progress: progressOf(counts).map((p, i) => ({ ...p, customItemId: items[i].id })),
      });
    },
    useSession: () => {
      const port = useCustomPort(GROUP);
      useCustomOpening(GROUP, port.ready);
      return useAthkarSession(port);
    },
  },
] as const;

type Listener = (state: AppStateStatus) => void;
let listeners: Listener[];
const emit = (state: AppStateStatus) => [...listeners].forEach((l) => l(state));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  goToDay(TODAY);
  // A day the tables have not counted on starts every dhikr at zero.
  const fresh = (i: number) => ({ current_count: 0, total_count: TARGETS[i] });
  mockDailyRows.mockImplementation(async (_date, session) =>
    session === ATHKAR_TYPE.MORNING
      ? TARGETS.map((_, i) => ({ thikr_id: dailyId(i), ...fresh(i) }))
      : []
  );
  mockHisnRows.mockImplementation(async () =>
    TARGETS.map((_, i) => ({ my_athkar_id: i + 1, ...fresh(i) }))
  );
  mockCustomRows.mockImplementation(async () =>
    TARGETS.map((_, i) => ({ custom_item_id: i + 1, ...fresh(i) }))
  );
  listeners = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
    const l = handler as Listener;
    listeners.push(l);
    return { remove: () => listeners.splice(listeners.indexOf(l), 1) } as ReturnType<
      typeof AppState.addEventListener
    >;
  });
  useAthkarCollectionSession.setState({ places: {}, pending: null });
  // Both collection stores load with My Athkar, whichever one a session reads.
  useMyAthkarStore.setState({ isInitialized: true, items: [], progress: [] });
  useCustomAthkarStore.setState({ isInitialized: true, groups: [], items: [], progress: [] });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe.each(SOURCES)("the session rules over $name", ({ seed, useSession, writes }) => {
  const open = async ({ counts = [], autoMoveToNext = true }: Seed = {}) => {
    seedSettings(autoMoveToNext);
    seed(counts);
    const { result } = await renderHook(useSession);
    const session = () => result.current;
    const countAt = (index: number) => session().counts[session().items[index].id] ?? 0;
    return {
      session,
      countAt,
      tap: () => act(() => session().add()),
      pass: (ms: number = ADVANCE_PAUSE_MS) => act(() => jest.advanceTimersByTime(ms)),
      settle: () => act(() => jest.advanceTimersByTimeAsync(0)),
    };
  };

  /** The day and the count of the last write. */
  const lastWrite = () => {
    const [day, , count] = writes.mock.lastCall ?? [];
    return { day, count };
  };

  test("it opens on the first unfinished dhikr", async () => {
    const { session } = await open({ counts: [1, 0, 0] });
    expect(session().status).toBe(SESSION_STATUS.READY);
    expect(session().index).toBe(B);
    expect(session().items.map(({ target }) => target)).toEqual([...TARGETS]);
  });

  test("a count never passes its target", async () => {
    const { session, countAt, tap } = await open({ counts: [1, 2, 0] });
    await tap();
    await tap();
    await tap();
    expect(countAt(B)).toBe(TARGETS[B]);
    expect(session().current?.count).toBe(TARGETS[B]);
  });

  test("adding many stops at the target", async () => {
    const { session, countAt } = await open({ counts: [1, 1, 0] });
    await act(() => session().addMany(10));
    expect(countAt(B)).toBe(TARGETS[B]);
  });

  test("reaching the target moves to the next dhikr after the pause, not before", async () => {
    const { session, tap, pass } = await open();
    await tap();
    expect(session().advancePending).toBe(true);
    await pass(ADVANCE_PAUSE_MS - 1);
    expect(session().index).toBe(A);
    await pass(1);
    expect(session().index).toBe(B);
    expect(session().advancePending).toBe(false);
  });

  test("a tap during the pause counts for no dhikr", async () => {
    const { countAt, tap, pass } = await open();
    await tap();
    await tap();
    await pass();
    expect(countAt(A)).toBe(TARGETS[A]);
    expect(countAt(B)).toBe(0);
  });

  test("a tap during the pause does not restart it", async () => {
    const { session, tap, pass } = await open();
    await tap();
    await pass(ADVANCE_PAUSE_MS / 2);
    await tap();
    await pass(ADVANCE_PAUSE_MS / 2);
    expect(session().index).toBe(B);
  });

  test("an undo during the pause cancels the move", async () => {
    const { session, countAt, tap, pass } = await open();
    await tap();
    await act(() => session().undo());
    await pass();
    expect(session().index).toBe(A);
    expect(session().advancePending).toBe(false);
    expect(countAt(A)).toBe(0);
  });

  test("a jump during the pause keeps the place it chose", async () => {
    const { session, tap, pass } = await open();
    await tap();
    await act(() => session().jumpTo(C));
    await pass();
    expect(session().index).toBe(C);
  });

  test("a finished dhikr opens at its full count", async () => {
    const { session } = await open({ counts: [1, 0, 0] });
    await act(() => session().step(STEP.PREVIOUS));
    expect(session().index).toBe(A);
    expect(session().current).toMatchObject({ count: TARGETS[A], done: true });
  });

  test("the move skips a finished dhikr", async () => {
    const { session, tap, pass } = await open({ counts: [0, 3, 0] });
    await tap();
    await pass();
    expect(session().index).toBe(C);
  });

  test("with auto-advance off the place stays", async () => {
    const { session, tap, pass } = await open({ autoMoveToNext: false });
    await tap();
    await pass();
    expect(session().index).toBe(A);
    expect(session().advancePending).toBe(false);
  });

  test("the last count holds the dhikr for the pause, then the session is done", async () => {
    const { session, tap, pass } = await open({ counts: [1, 3, 0] });
    await tap();
    expect(session().status).toBe(SESSION_STATUS.READY);
    await pass();
    expect(session().status).toBe(SESSION_STATUS.DONE);
    expect(session().index).toBeNull();
  });

  test("a tap on a finished dhikr moves on after the pause", async () => {
    const { session, countAt, tap, pass } = await open({ counts: [1, 0, 0] });
    await act(() => session().step(STEP.PREVIOUS));
    await tap();
    await pass();
    expect(countAt(A)).toBe(TARGETS[A]);
    expect(session().index).toBe(B);
  });

  test("adding many to a finished dhikr changes nothing", async () => {
    const { session, pass } = await open({ counts: [1, 0, 0] });
    await act(() => session().step(STEP.PREVIOUS));
    await act(() => session().addMany(10));
    expect(session().advancePending).toBe(false);
    await pass();
    expect(session().index).toBe(A);
  });

  test("a jump outside the session changes nothing", async () => {
    const { session } = await open();
    await act(() => session().jumpTo(TARGETS.length));
    expect(session().index).toBe(A);
  });

  test("leaving the app writes the pending count", async () => {
    const { tap } = await open({ counts: [1, 0, 0] });
    await act(() => emit(APP_STATE.INACTIVE));
    await act(() => emit(APP_STATE.ACTIVE));
    await tap();
    expect(writes).not.toHaveBeenCalled();
    await act(() => emit(APP_STATE.INACTIVE));
    expect(writes).toHaveBeenCalledTimes(1);
  });

  test("returning to the app on a new day reads that day's counts", async () => {
    const { countAt, settle } = await open({ counts: [1, 1, 0] });
    goToDay(TOMORROW);
    await act(() => emit(APP_STATE.INACTIVE));
    await act(() => emit(APP_STATE.ACTIVE));
    await settle();
    expect(countAt(A)).toBe(0);
    expect(countAt(B)).toBe(0);
  });

  test("a tap after midnight counts on the new day from zero", async () => {
    const { countAt, tap, settle } = await open({ counts: [1, 1, 0] });
    goToDay(TOMORROW);
    await tap();
    await settle();
    expect(countAt(B)).toBe(1);
    await act(() => jest.advanceTimersByTimeAsync(COUNT_WRITE_DELAY_MS));
    expect(lastWrite()).toEqual({ day: TOMORROW, count: 1 });
  });
});
