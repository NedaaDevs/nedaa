import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { PRAYER_DETAIL_STATE } from "@/constants/PrayerDetail";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { prayerDetailState } from "@/utils/prayerDetailState";

const DAY: DayPrayerTimes = {
  date: 20260925,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-25T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-25T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-25T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-25T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-25T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-25T05:50:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

const NO_ISHA: DayPrayerTimes = { ...DAY, timings: { ...DAY.timings, [PRAYER_ID.ISHA]: "" } };

const base = {
  prayerId: PRAYER_ID.ISHA,
  day: DAY,
  isLoading: false,
  hasError: false,
  settingsHydrated: true,
};

describe("prayerDetailState", () => {
  it("is ready once the prayer has a time and its settings are read", () => {
    expect(prayerDetailState(base)).toBe(PRAYER_DETAIL_STATE.READY);
  });

  // A reload or a stale error must not hide a prayer whose time is already known.
  it("stays ready while the times reload or after a failed refresh", () => {
    expect(prayerDetailState({ ...base, isLoading: true, hasError: true })).toBe(
      PRAYER_DETAIL_STATE.READY
    );
  });

  it("loads until the stored alert settings are read", () => {
    expect(prayerDetailState({ ...base, settingsHydrated: false })).toBe(
      PRAYER_DETAIL_STATE.LOADING
    );
  });

  it.each([
    ["no day", null],
    ["the prayer missing from the day", NO_ISHA],
  ])("loads while the times load, with %s", (_, day) => {
    expect(prayerDetailState({ ...base, day, isLoading: true })).toBe(PRAYER_DETAIL_STATE.LOADING);
  });

  it("fails when the times failed to load and the prayer has none", () => {
    expect(prayerDetailState({ ...base, day: null, hasError: true, isLoading: true })).toBe(
      PRAYER_DETAIL_STATE.ERROR
    );
  });

  it("fails before the settings are read, since no settings can help", () => {
    expect(
      prayerDetailState({ ...base, day: NO_ISHA, hasError: true, settingsHydrated: false })
    ).toBe(PRAYER_DETAIL_STATE.ERROR);
  });

  it("is unavailable when nothing loads and the prayer has no time", () => {
    expect(prayerDetailState({ ...base, day: NO_ISHA })).toBe(PRAYER_DETAIL_STATE.UNAVAILABLE);
    expect(prayerDetailState({ ...base, day: null })).toBe(PRAYER_DETAIL_STATE.UNAVAILABLE);
  });
});
