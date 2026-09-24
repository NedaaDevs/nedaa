import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { COUNT_AXIS } from "@/constants/Countdown";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { useCountdownTimer } from "@/hooks/useCountdownTimer";
import { SimulatedClockContext } from "@/hooks/useTodayClock";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";

const DAY: DayPrayerTimes = {
  date: 20260923,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-23T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-23T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-23T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-23T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-23T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-23T05:50:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

describe("useCountdownTimer", () => {
  beforeEach(() => {
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: DAY,
      tomorrowTimings: null,
    });
    usePreferencesStore.setState({
      showSeconds: false,
      iqamaCountUpEnabled: false,
      iqamaCountUpMinutes: 30,
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
