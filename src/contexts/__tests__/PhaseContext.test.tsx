import { AppState } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { APP_STATE } from "@/constants/AppState";
import { PHASE } from "@/constants/Phase";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { usePrayerPhaseSource } from "@/contexts/PhaseContext";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";

const day = (date: string, fajr: string): DayPrayerTimes => ({
  date: Number(date.replaceAll("-", "")),
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: `${date}T${fajr}:00.000Z`,
    [PRAYER_ID.DHUHR]: `${date}T12:00:00.000Z`,
    [PRAYER_ID.ASR]: `${date}T15:20:00.000Z`,
    [PRAYER_ID.MAGHRIB]: `${date}T18:05:00.000Z`,
    [PRAYER_ID.ISHA]: `${date}T19:25:00.000Z`,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: `${date}T05:50:00.000Z`,
  } as DayPrayerTimes["otherTimings"],
});

describe("usePrayerPhaseSource", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-23T17:00:00.000Z"));
    usePrayerTimesStore.setState({
      todayTimings: day("2026-09-23", "04:30"),
      tomorrowTimings: day("2026-09-24", "04:31"),
    });
  });
  afterEach(() => jest.useRealTimers());

  it("is unknown until the day's times are loaded", async () => {
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: null,
      tomorrowTimings: null,
    });

    const { result } = await renderHook(() => usePrayerPhaseSource());

    expect(result.current).toBeUndefined();
  });

  it("turns to Maghrib when Maghrib begins", async () => {
    const { result } = await renderHook(() => usePrayerPhaseSource());
    expect(result.current).toBe(PHASE.ASR);

    await act(() => jest.advanceTimersByTime(66 * 60_000));

    expect(result.current).toBe(PHASE.MAGHRIB);
  });

  // The root re-renders on this hook, so it must wake for a new phase, not every minute.
  it("does not re-render between phase boundaries", async () => {
    let renders = 0;
    await renderHook(() => {
      renders += 1;
      return usePrayerPhaseSource();
    });
    const settled = renders;

    await act(() => jest.advanceTimersByTime(60 * 60_000));

    expect(renders - settled).toBe(0);
  });

  // The store rolls its days only on launch or foreground; a stale "today" must not spin.
  it("reads the right phase from a store a day behind, without re-rendering", async () => {
    jest.setSystemTime(new Date("2026-09-24T12:00:00.000Z"));
    let renders = 0;
    const { result } = await renderHook(() => {
      renders += 1;
      return usePrayerPhaseSource();
    });
    const settled = renders;

    for (let frame = 0; frame < 20; frame += 1) {
      await act(() => jest.advanceTimersByTime(1));
    }

    expect(result.current).toBe(PHASE.DAY);
    expect(renders - settled).toBe(0);
  });

  it("is not night on a daytime return before the store rolls", async () => {
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
      listeners.push(listener as (state: string) => void);
      return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
    });
    const { result } = await renderHook(() => usePrayerPhaseSource());

    await act(() => {
      jest.setSystemTime(new Date("2026-09-24T10:00:00.000Z"));
      listeners.forEach((listener) => listener(APP_STATE.ACTIVE));
    });

    expect(result.current).toBe(PHASE.DAY);
    jest.restoreAllMocks();
  });

  it("reads the clock again when the day's times change", async () => {
    const { result } = await renderHook(() => usePrayerPhaseSource());

    await act(() => {
      jest.setSystemTime(new Date("2026-09-23T20:00:00.000Z"));
      usePrayerTimesStore.setState({ todayTimings: day("2026-09-23", "04:30") });
    });
    await act(() => jest.advanceTimersByTime(0));

    expect(result.current).toBe(PHASE.NIGHT);
  });
});
