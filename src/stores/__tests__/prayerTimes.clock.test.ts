import { usePrayerTimesStore } from "@/stores/prayerTimes";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const day = (date: number, hours: Record<string, string>) => ({
  date,
  timezone: "UTC",
  timings: {
    fajr: `2026-07-${date}T05:00:00Z`,
    dhuhr: `2026-07-${date}T12:00:00Z`,
    asr: `2026-07-${date}T15:00:00Z`,
    maghrib: `2026-07-${date}T19:00:00Z`,
    isha: `2026-07-${date}T21:00:00Z`,
    ...hours,
  },
  otherTimings: {
    sunrise: `2026-07-${date}T06:00:00Z`,
    midnight: `2026-07-${date}T23:00:00Z`,
  },
});

const seed = () => {
  usePrayerTimesStore.setState({
    yesterdayTimings: day(28, {}) as never,
    todayTimings: day(29, {}) as never,
    tomorrowTimings: day(30, {}) as never,
  });
};

describe("prayer getters honour an injected clock", () => {
  beforeEach(seed);

  test("getNextPrayer reports the prayer after the given moment", () => {
    const morning = new Date("2026-07-29T13:00:00Z");

    expect(usePrayerTimesStore.getState().getNextPrayer(morning)?.name).toBe("asr");
  });

  test("getNextPrayer rolls over as the moment advances past a prayer", () => {
    const beforeAsr = new Date("2026-07-29T14:59:00Z");
    const afterAsr = new Date("2026-07-29T15:01:00Z");

    const { getNextPrayer } = usePrayerTimesStore.getState();

    expect(getNextPrayer(beforeAsr)?.name).toBe("asr");
    expect(getNextPrayer(afterAsr)?.name).toBe("maghrib");
  });

  test("getPreviousPrayer reports the prayer before the given moment", () => {
    const afterAsr = new Date("2026-07-29T15:30:00Z");

    expect(usePrayerTimesStore.getState().getPreviousPrayer(afterAsr)?.name).toBe("asr");
  });

  test("getNextOtherTiming honours the given moment", () => {
    const beforeSunrise = new Date("2026-07-29T05:30:00Z");

    expect(usePrayerTimesStore.getState().getNextOtherTiming(beforeSunrise)?.name).toBe("sunrise");
  });

  test("past the last prayer, the next one comes from tomorrow", () => {
    const lateNight = new Date("2026-07-29T22:00:00Z");

    expect(usePrayerTimesStore.getState().getNextPrayer(lateNight)?.date).toBe(30);
  });

  test("falls back to the current time when no moment is given", () => {
    expect(() => usePrayerTimesStore.getState().getNextPrayer()).not.toThrow();
  });
});
