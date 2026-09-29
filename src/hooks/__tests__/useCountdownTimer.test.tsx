import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { COUNT_AXIS } from "@/constants/Countdown";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { useCountdownTimer, usePrayerCountdown } from "@/hooks/useCountdownTimer";
import { SimulatedClockContext } from "@/hooks/useTodayClock";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";

const dayOn = (date: string): DayPrayerTimes => ({
  date: Number(date.replaceAll("-", "")),
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: `${date}T04:30:00.000Z`,
    [PRAYER_ID.DHUHR]: `${date}T12:00:00.000Z`,
    [PRAYER_ID.ASR]: `${date}T15:20:00.000Z`,
    [PRAYER_ID.MAGHRIB]: `${date}T18:05:00.000Z`,
    [PRAYER_ID.ISHA]: `${date}T19:25:00.000Z`,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: `${date}T05:50:00.000Z`,
  } as DayPrayerTimes["otherTimings"],
});
const DAY = dayOn("2026-09-23");

describe("useCountdownTimer", () => {
  beforeEach(() => {
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: DAY,
      tomorrowTimings: null,
    });
    usePreferencesStore.setState({
      showSeconds: false,
    });
  });
  afterEach(() => jest.useRealTimers());

  it("counts to the next prayer, or from the last when flipped", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    const { result, rerender } = await renderHook(
      ({ flipped }: { flipped: boolean }) => useCountdownTimer(flipped),
      { initialProps: { flipped: false } }
    );
    expect(result.current?.axis).toBe(COUNT_AXIS.UNTIL);

    await rerender({ flipped: true });

    expect(result.current?.axis).toBe(COUNT_AXIS.SINCE);
  });

  // A figure in seconds must move every second.
  it("ticks each second while seconds show", async () => {
    usePreferencesStore.setState({ showSeconds: true });
    jest.useFakeTimers({ now: new Date("2026-09-23T15:10:00.000Z") });
    const { result } = await renderHook(() => useCountdownTimer(false));
    const before = result.current!.seconds;

    await act(() => jest.advanceTimersByTime(1000));

    expect(result.current!.seconds).toBe(before - 1);
  });

  it("follows Today's clock while a simulated day plays", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SimulatedClockContext value={new Date("2026-09-23T13:00:00.000Z")}>
        {children}
      </SimulatedClockContext>
    );
    const { result } = await renderHook(() => useCountdownTimer(false), { wrapper });

    expect(result.current?.seconds).toBe(140 * 60);
  });
});

describe("usePrayerCountdown", () => {
  beforeEach(() => {
    usePrayerTimesStore.setState({
      yesterdayTimings: dayOn("2026-09-22"),
      todayTimings: DAY,
      tomorrowTimings: dayOn("2026-09-24"),
    });
    usePreferencesStore.setState({
      showSeconds: false,
    });
  });
  afterEach(() => jest.useRealTimers());

  it("counts one prayer, to its next time when flipped", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    const { result, rerender } = await renderHook(
      ({ flipped }: { flipped: boolean }) => usePrayerCountdown(PRAYER_ID.DHUHR, flipped),
      { initialProps: { flipped: false } }
    );
    expect(result.current?.axis).toBe(COUNT_AXIS.SINCE);
    expect(result.current?.seconds).toBe(122 * 60);

    await rerender({ flipped: true });

    expect(result.current?.axis).toBe(COUNT_AXIS.UNTIL);
    expect(result.current?.counted.time).toEqual(new Date("2026-09-24T12:00:00.000Z"));
  });

  it("ticks each second while seconds show", async () => {
    usePreferencesStore.setState({ showSeconds: true });
    jest.useFakeTimers({ now: new Date("2026-09-23T15:10:00.000Z") });
    const { result } = await renderHook(() => usePrayerCountdown(PRAYER_ID.MAGHRIB, false));
    const before = result.current!.seconds;

    await act(() => jest.advanceTimersByTime(1000));

    expect(result.current!.seconds).toBe(before - 1);
  });

  it("follows Today's clock while a simulated day plays", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SimulatedClockContext value={new Date("2026-09-23T13:00:00.000Z")}>
        {children}
      </SimulatedClockContext>
    );
    const { result } = await renderHook(() => usePrayerCountdown(PRAYER_ID.MAGHRIB, false), {
      wrapper,
    });

    expect(result.current?.seconds).toBe(305 * 60);
  });
});
