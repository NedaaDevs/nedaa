import { COUNT_AXIS, PRAYER_FOCUS } from "@/constants/Countdown";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { focusCount, formatCount, type CountSettings } from "@/utils/focusCount";

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
const DAYS = {
  yesterday: day("2026-09-22"),
  today: day("2026-09-23"),
  tomorrow: day("2026-09-24"),
};
const OFF: CountSettings = { seconds: false };
const at = (iso: string) => new Date(`${iso}.000Z`);
const count = (iso: string, settings = OFF, flipped = false) =>
  focusCount(at(iso), DAYS, settings, flipped)!;

describe("focusCount", () => {
  it("counts down to the next prayer by default", () => {
    const result = count("2026-09-23T14:02:00");

    expect(result.axis).toBe(COUNT_AXIS.UNTIL);
    expect(result.named.id).toBe(PRAYER_ID.ASR);
    expect(result.counted.id).toBe(PRAYER_ID.ASR);
    expect(result.seconds).toBe(78 * 60);
    expect(result.precise).toBe(false);
  });

  // Between prayers the name stays on the next; only the direction flips.
  it("counts up from the last prayer when flipped", () => {
    const result = count("2026-09-23T14:10:00", OFF, true);

    expect(result.axis).toBe(COUNT_AXIS.SINCE);
    expect(result.named.id).toBe(PRAYER_ID.ASR);
    expect(result.counted.id).toBe(PRAYER_ID.DHUHR);
    expect(result.seconds).toBe(130 * 60);
  });

  it("reaches into tomorrow after Isha and into yesterday before Fajr", () => {
    expect(count("2026-09-23T23:00:00").named.time).toEqual(at("2026-09-24T04:30:00"));
    expect(count("2026-09-23T02:00:00", OFF, true).counted.time).toEqual(at("2026-09-22T19:25:00"));
  });

  it("has nothing to count toward when no later prayer is stored", () => {
    expect(focusCount(at("2026-09-24T22:00:00"), DAYS, OFF, false)).toBeNull();
  });

  describe("the Show seconds setting", () => {
    const on = { ...OFF, seconds: true };

    it("counts to the second both ways", () => {
      expect(count("2026-09-23T14:02:18", on).precise).toBe(true);
      expect(count("2026-09-23T14:02:18", on, true).precise).toBe(true);
    });

    it("counts in minutes when it is off", () => {
      expect(count("2026-09-23T14:02:18").precise).toBe(false);
    });
  });

  // A prayer stays in focus for a while after its time comes in, counting up.
  describe("a prayer just come in", () => {
    const window = PRAYER_FOCUS.activeMs / 60_000;

    it("names it and counts up from it", () => {
      const result = count("2026-09-23T15:32:00");

      expect(result.axis).toBe(COUNT_AXIS.SINCE);
      expect(result.named.id).toBe(PRAYER_ID.ASR);
      expect(result.counted.id).toBe(PRAYER_ID.ASR);
      expect(result.current).toBe(true);
      expect(result.seconds).toBe(12 * 60);
    });

    // Flipped, the block names what it counts to: the next prayer.
    it("flips to the next prayer's countdown", () => {
      const result = count("2026-09-23T15:32:00", OFF, true);

      expect(result.axis).toBe(COUNT_AXIS.UNTIL);
      expect(result.named.id).toBe(PRAYER_ID.MAGHRIB);
      expect(result.current).toBe(false);
    });

    it("hands over to the next prayer once its window ends", () => {
      const minutes = String(20 + window).padStart(2, "0");
      const result = count(`2026-09-23T15:${minutes}:00`);

      expect(result.named.id).toBe(PRAYER_ID.MAGHRIB);
      expect(result.axis).toBe(COUNT_AXIS.UNTIL);
      expect(result.current).toBe(false);
    });

    it("stays on Isha for its window before tomorrow's Fajr", () => {
      expect(count("2026-09-23T19:40:00").named.id).toBe(PRAYER_ID.ISHA);
    });
  });
});

describe("formatCount", () => {
  it.each([
    ["an hour and more", 78 * 60, false, COUNT_AXIS.UNTIL, "1:18"],
    ["a part minute left, rounded up", 77 * 60 + 30, false, COUNT_AXIS.UNTIL, "1:18"],
    ["a part minute gone, rounded down", 130 * 60 + 40, false, COUNT_AXIS.SINCE, "2:10"],
    ["seconds under an hour", 11 * 60 + 42, true, COUNT_AXIS.UNTIL, "11:42"],
    ["seconds from an hour up", 78 * 60 + 42, true, COUNT_AXIS.UNTIL, "1:18:42"],
  ])("shows %s", (_name, seconds, precise, axis, shown) => {
    expect(formatCount(seconds, precise, axis)).toBe(shown);
  });
});
