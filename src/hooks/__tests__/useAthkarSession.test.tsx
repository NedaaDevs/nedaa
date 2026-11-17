import { AppState, AppStateStatus } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

const mockWriteCount = jest.fn(async () => true);
jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: jest.fn(async () => {}) }));
jest.mock("@/services/athkar-db", () => ({
  AthkarDB: {
    updateAthkarCount: () => mockWriteCount(),
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
import { APP_STATE } from "@/constants/AppState";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { STEP } from "@/constants/AthkarFocus";
import { ADVANCE_PAUSE_MS, MARK_STATE, SESSION_STATUS } from "@/constants/AthkarSession";
import { useAthkarSession, useSessionOpening } from "@/hooks/useAthkarSession";
import { useAthkarStore } from "@/stores/athkar";
import type { Athkar } from "@/types/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
import { getTodayInt } from "@/utils/athkar";
/* eslint-enable import/first */

const dhikr = (order: number, count: number, extra: Partial<Athkar> = {}): Athkar => ({
  id: `${order}-${ATHKAR_TYPE.MORNING}`,
  title: `title.${order}`,
  text: `text.${order}`,
  count,
  type: ATHKAR_TYPE.MORNING,
  order,
  ...extra,
});

const QULS = ["qul.1", "qul.2", "qul.3"];
const first = dhikr(1, 1);
const quls = dhikr(2, 9, { group: { texts: QULS, audioIds: [], itemsPerRound: 3 } });
const last = dhikr(3, 1);
const list = [first, quls, last];

type Listener = (state: AppStateStatus) => void;
let listeners: Listener[];
const emit = (state: AppStateStatus) => [...listeners].forEach((l) => l(state));

const seed = (counts: Record<string, number> = {}) =>
  useAthkarStore.setState({
    morningAthkarList: list,
    eveningAthkarList: [],
    currentType: ATHKAR_TYPE.MORNING,
    currentAthkarIndex: 0,
    lastMorningIndex: 0,
    lastEveningIndex: 0,
    advancePending: false,
    progressDay: getTodayInt("Asia/Riyadh"),
    playerState: PLAYER_STATE.IDLE,
    currentAthkarId: null,
    settings: { autoMoveToNext: true, showStreak: true, showTranslation: true },
    currentProgress: list.map((a) => ({
      athkarId: a.id,
      currentCount: counts[a.id] ?? 0,
      totalCount: a.count,
      completed: (counts[a.id] ?? 0) >= a.count,
    })),
  });

/** The session as the reader holds it: opened, then read. */
const renderSession = () =>
  renderHook(() => {
    useSessionOpening();
    return useAthkarSession();
  });

const ALL_DONE = { [first.id]: 1, [quls.id]: 9, [last.id]: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  listeners = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
    const l = handler as Listener;
    listeners.push(l);
    return { remove: () => listeners.splice(listeners.indexOf(l), 1) } as ReturnType<
      typeof AppState.addEventListener
    >;
  });
  seed();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useAthkarSession", () => {
  test("a loaded session shows the current dhikr and its count", async () => {
    const { result } = await renderSession();
    expect(result.current.status).toBe(SESSION_STATUS.READY);
    expect(result.current.index).toBe(0);
    expect(result.current.current).toMatchObject({
      textKey: first.text,
      count: 0,
      target: 1,
      done: false,
      audioOwnsCount: false,
    });
    expect(result.current.next).toEqual({ textKey: QULS[0] });
    expect(result.current.canUndo).toBe(false);
  });

  test("a count, then the pause, opens the next dhikr", async () => {
    const { result } = await renderSession();
    await act(() => result.current.add());
    expect(result.current.advancePending).toBe(true);
    expect(result.current.current).toMatchObject({ count: 1, done: true });
    expect(result.current.canUndo).toBe(true);
    await act(() => jest.advanceTimersByTime(ADVANCE_PAUSE_MS));
    expect(result.current.index).toBe(1);
    expect(result.current.advancePending).toBe(false);
  });

  test("undo lowers the current count", async () => {
    seed({ [quls.id]: 2 });
    useAthkarStore.setState({ currentAthkarIndex: 1, lastMorningIndex: 1 });
    const { result } = await renderSession();
    await act(() => result.current.undo());
    expect(result.current.current?.count).toBe(1);
  });

  test("a group shows the text its count has reached", async () => {
    seed({ [first.id]: 1, [quls.id]: 4 });
    const { result } = await renderSession();
    expect(result.current.index).toBe(1);
    expect(result.current.current?.textKey).toBe(QULS[1]);
  });

  test("it opens on the first unfinished dhikr from the last place", async () => {
    seed({ [first.id]: 1 });
    useAthkarStore.setState({ lastMorningIndex: 0 });
    const { result } = await renderSession();
    expect(result.current.index).toBe(1);
  });

  test("a second reader of the session keeps the place it finds", async () => {
    seed({ [first.id]: 1 });
    const { result } = await renderHook(() => useAthkarSession());
    expect(result.current.index).toBe(0);
    expect(result.current.current?.done).toBe(true);
  });

  test("the last open dhikr has no next", async () => {
    seed({ [first.id]: 1, [quls.id]: 9 });
    const { result } = await renderSession();
    expect(result.current.index).toBe(2);
    expect(result.current.next).toBeNull();
  });

  test("a finished session has no place and no current mark", async () => {
    seed(ALL_DONE);
    const { result } = await renderSession();
    expect(result.current.status).toBe(SESSION_STATUS.DONE);
    expect(result.current.index).toBeNull();
    expect(result.current.current).toBeNull();
    expect(result.current.marks.map((m) => m.state)).toEqual([
      MARK_STATE.DONE,
      MARK_STATE.DONE,
      MARK_STATE.DONE,
    ]);
  });

  test("the last count holds the dhikr for the pause before the session reads done", async () => {
    seed({ [first.id]: 1, [quls.id]: 9 });
    const { result } = await renderSession();
    await act(() => result.current.add());
    expect(result.current.status).toBe(SESSION_STATUS.READY);
    expect(result.current.current?.done).toBe(true);
    await act(() => jest.advanceTimersByTime(ADVANCE_PAUSE_MS));
    expect(result.current.status).toBe(SESSION_STATUS.DONE);
  });

  test("a session with no list or no loaded counts is loading", async () => {
    useAthkarStore.setState({ progressDay: null, currentProgress: [] });
    const { result } = await renderSession();
    expect(result.current.status).toBe(SESSION_STATUS.LOADING);
    expect(result.current.current).toBeNull();
  });

  test("audio that plays this dhikr owns its count", async () => {
    useAthkarStore.setState({ playerState: PLAYER_STATE.PLAYING, currentAthkarId: first.id });
    const { result } = await renderSession();
    expect(result.current.current?.audioOwnsCount).toBe(true);
  });

  test("audio keeps the count through its pause between two dhikr", async () => {
    useAthkarStore.setState({ playerState: PLAYER_STATE.LOADING, currentAthkarId: first.id });
    const { result } = await renderSession();
    expect(result.current.current?.audioOwnsCount).toBe(true);
  });

  test("audio that is starting on this dhikr owns its count", async () => {
    useAthkarStore.setState({ playerState: PLAYER_STATE.LOADING, loadingAthkarId: first.id });
    const { result } = await renderSession();
    expect(result.current.current?.audioOwnsCount).toBe(true);
  });

  test("a start that never ran leaves the count to the hand", async () => {
    useAthkarStore.setState({ playerState: PLAYER_STATE.IDLE, loadingAthkarId: first.id });
    const { result } = await renderSession();
    expect(result.current.current?.audioOwnsCount).toBe(false);
  });

  test("audio on another dhikr leaves this count to the hand", async () => {
    useAthkarStore.setState({ playerState: PLAYER_STATE.PLAYING, currentAthkarId: last.id });
    const { result } = await renderSession();
    expect(result.current.current?.audioOwnsCount).toBe(false);
  });

  test("a jump moves the place", async () => {
    const { result } = await renderSession();
    await act(() => result.current.jumpTo(2));
    expect(result.current.index).toBe(2);
  });

  test("leaving the app writes the pending count", async () => {
    const { result } = await renderSession();
    await act(() => emit(APP_STATE.INACTIVE));
    await act(() => emit(APP_STATE.ACTIVE));
    await act(() => result.current.add());
    expect(mockWriteCount).not.toHaveBeenCalled();
    await act(() => emit(APP_STATE.INACTIVE));
    expect(mockWriteCount).toHaveBeenCalledTimes(1);
  });

  test("returning to the app brings the store to the day", async () => {
    const syncDay = jest.fn(async () => {});
    useAthkarStore.setState({ syncDay });
    await renderSession();
    expect(syncDay).not.toHaveBeenCalled();
    await act(() => emit(APP_STATE.INACTIVE));
    expect(syncDay).not.toHaveBeenCalled();
    await act(() => emit(APP_STATE.ACTIVE));
    expect(syncDay).toHaveBeenCalledTimes(1);
  });

  test("leaving the screen writes the pending count", async () => {
    const { result, unmount } = await renderSession();
    await act(() => result.current.add());
    await unmount();
    expect(mockWriteCount).toHaveBeenCalledTimes(1);
  });

  test("a step moves one dhikr and stops at the ends", async () => {
    const { result } = await renderSession();
    expect(result.current.canStep).toEqual({ previous: false, next: true });
    await act(() => result.current.step(STEP.PREVIOUS));
    expect(result.current.index).toBe(0);
    await act(() => result.current.step(STEP.NEXT));
    await act(() => result.current.step(STEP.NEXT));
    expect(result.current.index).toBe(2);
    expect(result.current.canStep).toEqual({ previous: true, next: false });
    await act(() => result.current.step(STEP.NEXT));
    expect(result.current.index).toBe(2);
  });

  test("a step opens a finished dhikr at its full count", async () => {
    seed({ [first.id]: 1 });
    useAthkarStore.setState({ currentAthkarIndex: 1, lastMorningIndex: 1 });
    const { result } = await renderSession();
    await act(() => result.current.step(STEP.PREVIOUS));
    expect(result.current.index).toBe(0);
    expect(result.current.current).toMatchObject({ count: 1, done: true });
  });

  test("a step during the pause keeps the place it chose", async () => {
    seed({ [quls.id]: 8 });
    useAthkarStore.setState({ currentAthkarIndex: 1, lastMorningIndex: 1 });
    const { result } = await renderSession();
    await act(() => result.current.add());
    expect(result.current.advancePending).toBe(true);
    await act(() => result.current.step(STEP.PREVIOUS));
    expect(result.current.advancePending).toBe(false);
    await act(() => jest.advanceTimersByTime(ADVANCE_PAUSE_MS));
    expect(result.current.index).toBe(0);
  });

  test("adding many stops at the target and starts the pause", async () => {
    seed({ [quls.id]: 6 });
    useAthkarStore.setState({ currentAthkarIndex: 1, lastMorningIndex: 1 });
    const { result } = await renderSession();
    await act(() => result.current.addMany(10));
    expect(result.current.current).toMatchObject({ count: 9, done: true });
    expect(result.current.advancePending).toBe(true);
  });

  test("adding many leaves a dhikr the audio is counting", async () => {
    seed();
    useAthkarStore.setState({
      currentAthkarIndex: 1,
      lastMorningIndex: 1,
      playerState: PLAYER_STATE.PLAYING,
      currentAthkarId: quls.id,
    });
    const { result } = await renderSession();
    await act(() => result.current.addMany(5));
    expect(result.current.current?.count).toBe(0);
  });
});
