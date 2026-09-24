import { COUNT_AXIS } from "@/constants/Countdown";
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
const OFF: CountSettings = { seconds: false, iqama: { enabled: false, minutes: 30 } };
const at = (iso: string) => new Date(`${iso}.000Z`);
const count = (iso: string, settings = OFF, flipped = false) =>
  focusCount(at(iso), DAYS, settings, flipped)!;

describe("focusCount", () => {
  it("counts down to the next prayer by default", () => {
    const result = count("2026-09-23T14:02:00");

    expect(result.axis).toBe(COUNT_AXIS.UNTIL);
    expect(result.next.id).toBe(PRAYER_ID.ASR);
    expect(result.counted.id).toBe(PRAYER_ID.ASR);
    expect(result.seconds).toBe(78 * 60);
    expect(result.precise).toBe(false);
  });

  // The name always names the next prayer; only the figure's direction flips.
  it("counts up from the last prayer when flipped", () => {
    const result = count("2026-09-23T14:10:00", OFF, true);

    expect(result.axis).toBe(COUNT_AXIS.SINCE);
    expect(result.next.id).toBe(PRAYER_ID.ASR);
    expect(result.counted.id).toBe(PRAYER_ID.DHUHR);
    expect(result.seconds).toBe(130 * 60);
  });

  it("reaches into tomorrow after Isha and into yesterday before Fajr", () => {
    expect(count("2026-09-23T22:00:00").next.time).toEqual(at("2026-09-24T04:30:00"));
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

  describe("the Iqama Timer setting", () => {
    const on = { ...OFF, iqama: { enabled: true, minutes: 30 } };

    it("opens on the time since the athan while the window lasts", () => {
      const result = count("2026-09-23T12:08:05", on);

      expect(result.axis).toBe(COUNT_AXIS.SINCE);
      expect(result.counted.id).toBe(PRAYER_ID.DHUHR);
    });

    it("still flips to the countdown", () => {
      expect(count("2026-09-23T12:08:05", on, true).axis).toBe(COUNT_AXIS.UNTIL);
    });

    it("returns to the countdown once the window ends", () => {
      expect(count("2026-09-23T12:31:00", on).axis).toBe(COUNT_AXIS.UNTIL);
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
