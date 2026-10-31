import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { CELESTIAL_BODY } from "@/constants/Sky";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { celestialPositionAt } from "@/utils/celestial";
import type { StoredDays } from "@/utils/phase";

/** Fajr 04:00, sunrise 06:00, Maghrib 18:00, in UTC. */
const day = (date: string): DayPrayerTimes => ({
  date: Number(date.replaceAll("-", "")),
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: `${date}T04:00:00.000Z`,
    [PRAYER_ID.DHUHR]: `${date}T12:00:00.000Z`,
    [PRAYER_ID.ASR]: `${date}T15:00:00.000Z`,
    [PRAYER_ID.MAGHRIB]: `${date}T18:00:00.000Z`,
    [PRAYER_ID.ISHA]: `${date}T19:30:00.000Z`,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: `${date}T06:00:00.000Z`,
  } as DayPrayerTimes["otherTimings"],
});

const DAYS: StoredDays = { today: day("2026-09-23"), tomorrow: day("2026-09-24") };
const at = (instant: string) => new Date(`${instant}:00.000Z`);

describe("celestialPositionAt", () => {
  it.each([
    ["sunrise", "2026-09-23T06:00", CELESTIAL_BODY.SUN, 0],
    ["noon", "2026-09-23T12:00", CELESTIAL_BODY.SUN, 0.5],
    ["just before Maghrib", "2026-09-23T17:59", CELESTIAL_BODY.SUN, 719 / 720],
    ["Maghrib", "2026-09-23T18:00", CELESTIAL_BODY.MOON, 0],
    ["the middle of the night", "2026-09-23T23:00", CELESTIAL_BODY.MOON, 0.5],
  ])("at %s", (_name, instant, body, progress) => {
    const got = celestialPositionAt(at(instant), DAYS);

    expect(got?.body).toBe(body);
    expect(got?.progress).toBeCloseTo(progress);
  });

  // Between Fajr and sunrise the sun waits at the horizon it rises from.
  it("holds the sun at the start of its arc before sunrise", () => {
    expect(celestialPositionAt(at("2026-09-23T05:00"), DAYS)).toEqual({
      body: CELESTIAL_BODY.SUN,
      progress: 0,
    });
  });

  // The store rolls its days only on launch or foreground; "today" can be past.
  it("reads tomorrow's times once the day has turned before the store has", () => {
    expect(celestialPositionAt(at("2026-09-24T12:00"), DAYS)).toMatchObject({
      body: CELESTIAL_BODY.SUN,
      progress: 0.5,
    });
  });

  it("does not know where anything is before the first stored Fajr", () => {
    expect(celestialPositionAt(at("2026-09-23T03:00"), DAYS)).toBeUndefined();
  });

  it("does not know where anything is with no times stored", () => {
    expect(celestialPositionAt(at("2026-09-23T12:00"), {})).toBeUndefined();
  });
});
