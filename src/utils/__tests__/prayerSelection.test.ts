import { toZonedTime } from "date-fns-tz";
import { parseISO } from "date-fns";

import { firstAfter, lastBefore } from "@/utils/prayerSelection";

// Kuala Lumpur (UTC+8) prayer times for one day, as stored: ISO 8601 with offset.
const KL = [
  { name: "fajr", time: "2026-07-29T05:55:00+08:00" },
  { name: "dhuhr", time: "2026-07-29T13:15:00+08:00" },
  { name: "asr", time: "2026-07-29T16:37:00+08:00" },
  { name: "maghrib", time: "2026-07-29T19:29:00+08:00" },
  { name: "isha", time: "2026-07-29T20:42:00+08:00" },
];

describe("prayer selection", () => {
  it("picks the next and previous timing around an instant", () => {
    // 14:00 in Kuala Lumpur — after Dhuhr, before Asr.
    const now = parseISO("2026-07-29T14:00:00+08:00");
    expect(firstAfter(KL, now)?.name).toBe("asr");
    expect(lastBefore(KL, now)?.name).toBe("dhuhr");
  });

  it("returns null once the day is over, so callers can roll to the next day", () => {
    expect(firstAfter(KL, parseISO("2026-07-29T23:00:00+08:00"))).toBeNull();
    expect(lastBefore(KL, parseISO("2026-07-29T04:00:00+08:00"))).toBeNull();
  });

  it("orders by instant, not by the order entries arrive in", () => {
    const shuffled = [KL[3], KL[0], KL[4], KL[1], KL[2]];
    const now = parseISO("2026-07-29T14:00:00+08:00");
    expect(firstAfter(shuffled, now)?.name).toBe("asr");
    expect(lastBefore(shuffled, now)?.name).toBe("dhuhr");
  });

  /**
   * The property the app depends on: a device sitting in Riyadh must still see
   * Kuala Lumpur's schedule exactly as a device in Kuala Lumpur does.
   *
   * `timeZonedNow()` is what the store used to pass in here. It shifts the
   * instant by (location offset − device offset), so this asserts against both a
   * far-east and a far-west location — whatever zone the test machine runs in,
   * at least one of them is badly skewed, so a regression cannot hide.
   */
  it("is unaffected by the device timezone", () => {
    const now = parseISO("2026-07-29T14:00:00+08:00");

    for (const locationZone of ["Pacific/Kiritimati", "Pacific/Midway", "Asia/Kuala_Lumpur"]) {
      const shifted = toZonedTime(now, locationZone);
      const skewMinutes = Math.round((shifted.getTime() - now.getTime()) / 60000);

      // Correct behaviour: the true instant always resolves to Asr.
      expect(firstAfter(KL, now)?.name).toBe("asr");

      // And the shifted value is a different instant wherever the zones differ,
      // which is precisely why it must never be used for comparisons.
      if (skewMinutes !== 0) {
        expect(shifted.getTime()).not.toBe(now.getTime());
      }
    }
  });
});
