import { PHASE } from "@/constants/Phase";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { nextPhaseStart, phaseAt, type StoredDays } from "@/utils/phase";

type DayTimes = Record<PrayerId | typeof OTHER_TIMING.SUNRISE, string>;

const TIMES: DayTimes = {
  [PRAYER_ID.FAJR]: "04:30",
  [OTHER_TIMING.SUNRISE]: "05:50",
  [PRAYER_ID.DHUHR]: "12:00",
  [PRAYER_ID.ASR]: "15:20",
  [PRAYER_ID.MAGHRIB]: "18:05",
  [PRAYER_ID.ISHA]: "19:25",
};

/** A day's times as the store holds them: ISO instants. */
const day = (date: string, times: DayTimes = TIMES): DayPrayerTimes => {
  const iso = (key: keyof DayTimes) => `${date}T${times[key]}:00.000Z`;
  return {
    date: Number(date.replaceAll("-", "")),
    timezone: "UTC",
    timings: {
      [PRAYER_ID.FAJR]: iso(PRAYER_ID.FAJR),
      [PRAYER_ID.DHUHR]: iso(PRAYER_ID.DHUHR),
      [PRAYER_ID.ASR]: iso(PRAYER_ID.ASR),
      [PRAYER_ID.MAGHRIB]: iso(PRAYER_ID.MAGHRIB),
      [PRAYER_ID.ISHA]: iso(PRAYER_ID.ISHA),
    },
    otherTimings: {
      [OTHER_TIMING.SUNRISE]: iso(OTHER_TIMING.SUNRISE),
    } as DayPrayerTimes["otherTimings"],
  };
};

const DAYS: StoredDays = {
  yesterday: day("2026-09-22"),
  today: day("2026-09-23"),
  tomorrow: day("2026-09-24", { ...TIMES, [PRAYER_ID.FAJR]: "04:31" }),
};
const at = (instant: string) => new Date(`${instant}:00.000Z`);

describe("phaseAt", () => {
  it.each([
    ["2026-09-23T00:10", PHASE.NIGHT],
    ["2026-09-23T04:29", PHASE.NIGHT],
    ["2026-09-23T04:30", PHASE.DAWN],
    ["2026-09-23T05:50", PHASE.DAY],
    ["2026-09-23T12:00", PHASE.DAY],
    ["2026-09-23T15:20", PHASE.ASR],
    ["2026-09-23T18:05", PHASE.MAGHRIB],
    ["2026-09-23T19:24", PHASE.MAGHRIB],
    ["2026-09-23T19:25", PHASE.NIGHT],
    ["2026-09-23T23:59", PHASE.NIGHT],
  ])("at %s it is %s", (instant, phase) => {
    expect(phaseAt(at(instant), DAYS)).toBe(phase);
  });

  // The store rolls its days only on launch or foreground, so "today" can be yesterday.
  it("reads tomorrow's times once the day has turned before the store has", () => {
    expect(phaseAt(at("2026-09-24T10:00"), DAYS)).toBe(PHASE.DAY);
  });

  it("does not know the phase past the days the store holds", () => {
    expect(phaseAt(at("2026-09-26T10:00"), DAYS)).toBeUndefined();
  });

  // That night began at an Isha the store does not hold.
  it("does not guess the night before the first stored Fajr", () => {
    expect(phaseAt(at("2026-09-23T17:00"), { tomorrow: DAYS.tomorrow })).toBeUndefined();
  });

  it("does not know the phase before any times are stored", () => {
    expect(phaseAt(at("2026-09-23T10:00"), {})).toBeUndefined();
  });
});

describe("nextPhaseStart", () => {
  it("is the next boundary across the stored days", () => {
    expect(nextPhaseStart(at("2026-09-23T12:00"), DAYS)).toEqual(at("2026-09-23T15:20"));
    expect(nextPhaseStart(at("2026-09-23T21:00"), DAYS)).toEqual(at("2026-09-24T04:31"));
  });

  // A boundary at or before now would wake the root at once, again and again.
  it("is never at or before now", () => {
    for (const instant of ["2026-09-24T10:00", "2026-09-24T23:00", "2026-09-26T10:00"]) {
      const next = nextPhaseStart(at(instant), DAYS);
      if (next) expect(next.getTime()).toBeGreaterThan(at(instant).getTime());
    }
  });

  it("is when the stored days run out, after the last boundary", () => {
    const next = nextPhaseStart(at("2026-09-24T23:00"), DAYS);

    expect(next).toBeDefined();
    expect(phaseAt(next!, DAYS)).toBeUndefined();
  });
});
