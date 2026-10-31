import { COUNT_AXIS } from "@/constants/Countdown";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import type { CountSettings } from "@/utils/focusCount";
import type { StoredDays } from "@/utils/phase";
import { prayerCount } from "@/utils/prayerCount";

const day = (date: string): DayPrayerTimes => ({
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
const DAYS: StoredDays = {
  yesterday: day("2026-09-22"),
  today: day("2026-09-23"),
  tomorrow: day("2026-09-24"),
};
const OFF: CountSettings = { seconds: false };
const at = (iso: string) => new Date(`${iso}.000Z`);

describe("prayerCount", () => {
  it("counts down to a prayer still to come", () => {
    const result = prayerCount(PRAYER_ID.MAGHRIB, at("2026-09-23T14:02:00"), DAYS, OFF, false)!;

    expect(result.axis).toBe(COUNT_AXIS.UNTIL);
    expect(result.named.time).toEqual(at("2026-09-23T18:05:00"));
    expect(result.counted).toEqual(result.named);
    expect(result.seconds).toBe(243 * 60);
    expect(result.current).toBe(false);
  });

  it("counts up from a prayer already in", () => {
    const result = prayerCount(PRAYER_ID.DHUHR, at("2026-09-23T14:02:00"), DAYS, OFF, false)!;

    expect(result.axis).toBe(COUNT_AXIS.SINCE);
    expect(result.named.time).toEqual(at("2026-09-23T12:00:00"));
    expect(result.seconds).toBe(122 * 60);
    expect(result.current).toBe(false);
  });

  it("marks a prayer inside its focus window as current", () => {
    const result = prayerCount(PRAYER_ID.ASR, at("2026-09-23T15:32:00"), DAYS, OFF, false)!;

    expect(result.axis).toBe(COUNT_AXIS.SINCE);
    expect(result.current).toBe(true);
    expect(result.seconds).toBe(12 * 60);
  });

  // Flipped, the prayer keeps its name; the figure moves to its other time.
  describe("flipped", () => {
    it("counts from the prayer's last time when it is still to come", () => {
      const result = prayerCount(PRAYER_ID.MAGHRIB, at("2026-09-23T14:02:00"), DAYS, OFF, true)!;

      expect(result.axis).toBe(COUNT_AXIS.SINCE);
      expect(result.named.time).toEqual(at("2026-09-23T18:05:00"));
      expect(result.counted.time).toEqual(at("2026-09-22T18:05:00"));
      expect(result.seconds).toBe((19 * 60 + 57) * 60);
    });

    it("counts to the prayer's next time when it is already in", () => {
      const result = prayerCount(PRAYER_ID.DHUHR, at("2026-09-23T14:02:00"), DAYS, OFF, true)!;

      expect(result.axis).toBe(COUNT_AXIS.UNTIL);
      expect(result.counted.time).toEqual(at("2026-09-24T12:00:00"));
      expect(result.seconds).toBe((21 * 60 + 58) * 60);
    });

    it("keeps its side when the other time is not stored", () => {
      const days = { today: DAYS.today };
      const result = prayerCount(PRAYER_ID.DHUHR, at("2026-09-23T14:02:00"), days, OFF, true)!;

      expect(result.axis).toBe(COUNT_AXIS.SINCE);
      expect(result.counted.time).toEqual(at("2026-09-23T12:00:00"));
    });
  });

  // The figure counts the time the prayer's Today card shows.
  describe("across the night", () => {
    it("counts Fajr from this morning while Isha is in its window", () => {
      const result = prayerCount(PRAYER_ID.FAJR, at("2026-09-23T19:40:00"), DAYS, OFF, false)!;

      expect(result.axis).toBe(COUNT_AXIS.SINCE);
      expect(result.named.time).toEqual(at("2026-09-23T04:30:00"));
    });

    it("counts down to tomorrow's Fajr once Isha's window ends", () => {
      const result = prayerCount(PRAYER_ID.FAJR, at("2026-09-23T23:00:00"), DAYS, OFF, false)!;

      expect(result.axis).toBe(COUNT_AXIS.UNTIL);
      expect(result.named.time).toEqual(at("2026-09-24T04:30:00"));
      expect(result.seconds).toBe(330 * 60);
    });

    it("keeps the night's Isha after midnight", () => {
      const result = prayerCount(PRAYER_ID.ISHA, at("2026-09-24T02:00:00"), DAYS, OFF, false)!;

      expect(result.axis).toBe(COUNT_AXIS.SINCE);
      expect(result.named.time).toEqual(at("2026-09-23T19:25:00"));
    });
  });

  it("counts to the second with Show seconds on", () => {
    const result = prayerCount(
      PRAYER_ID.MAGHRIB,
      at("2026-09-23T14:02:18"),
      DAYS,
      { seconds: true },
      false
    )!;

    expect(result.precise).toBe(true);
    expect(result.seconds).toBe(243 * 60 - 18);
  });

  it("has nothing to count with no day stored", () => {
    expect(prayerCount(PRAYER_ID.FAJR, at("2026-09-23T14:02:00"), {}, OFF, false)).toBeNull();
  });
});
