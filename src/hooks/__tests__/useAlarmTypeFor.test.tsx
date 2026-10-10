import { renderHook } from "@testing-library/react-native";

import { ALARM_TYPE } from "@/constants/Alarm";
import { OTHER_TIMING, PRAYER_ID, PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import { useAlarmTypeFor } from "@/hooks/useAlarmTypeFor";
import type { DayPrayerTimes } from "@/types/prayerTimes";

let mockDay: DayPrayerTimes | null = null;
jest.mock("@/hooks/useShownDay", () => ({
  useShownDay: () => ({ now: new Date(0), day: mockDay, following: null }),
}));

let mockSupported = true;
jest.mock("@/hooks/useAlarmSupported", () => ({ useAlarmSupported: () => mockSupported }));

/** A stored day whose every time is `at`; only Dhuhr's weekday matters here. */
const dayAt = (timezone: string, at: string): DayPrayerTimes => ({
  date: 0,
  timezone,
  timings: {
    [PRAYER_ID.FAJR]: at,
    [PRAYER_ID.DHUHR]: at,
    [PRAYER_ID.ASR]: at,
    [PRAYER_ID.MAGHRIB]: at,
    [PRAYER_ID.ISHA]: at,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: at,
    [OTHER_TIMING.SUNSET]: at,
    [OTHER_TIMING.IMSAK]: at,
    [OTHER_TIMING.MIDNIGHT]: at,
    [OTHER_TIMING.FIRST_THIRD]: at,
    [OTHER_TIMING.LAST_THIRD]: at,
  },
});

// Friday noon at UTC+14 is still Thursday in UTC.
const KIRITIMATI_FRIDAY_NOON = "2026-07-23T22:00:00.000Z";
const RIYADH_FRIDAY_DHUHR = "2026-07-24T09:10:00.000Z";
const RIYADH_SATURDAY_DHUHR = "2026-07-25T09:10:00.000Z";

const typeFor = async (prayerId: PrayerId) =>
  (await renderHook(() => useAlarmTypeFor(prayerId))).result.current;

beforeEach(() => {
  mockDay = dayAt("Asia/Riyadh", RIYADH_FRIDAY_DHUHR);
  mockSupported = true;
});

describe("useAlarmTypeFor", () => {
  it("offers the Fajr alarm for Fajr", async () => {
    mockDay = dayAt("Asia/Riyadh", RIYADH_SATURDAY_DHUHR);
    expect(await typeFor(PRAYER_ID.FAJR)).toBe(ALARM_TYPE.FAJR);
  });

  it("offers the Friday alarm for Dhuhr on a Friday only", async () => {
    expect(await typeFor(PRAYER_ID.DHUHR)).toBe(ALARM_TYPE.FRIDAY);
    mockDay = dayAt("Asia/Riyadh", RIYADH_SATURDAY_DHUHR);
    expect(await typeFor(PRAYER_ID.DHUHR)).toBeNull();
  });

  it("reads Friday in the shown day's own zone", async () => {
    mockDay = dayAt("Pacific/Kiritimati", KIRITIMATI_FRIDAY_NOON);
    expect(await typeFor(PRAYER_ID.DHUHR)).toBe(ALARM_TYPE.FRIDAY);
    mockDay = dayAt("UTC", KIRITIMATI_FRIDAY_NOON);
    expect(await typeFor(PRAYER_ID.DHUHR)).toBeNull();
  });

  it("offers nothing for the other prayers or before the times load", async () => {
    for (const id of PRAYER_IDS.filter((p) => p !== PRAYER_ID.FAJR && p !== PRAYER_ID.DHUHR)) {
      expect(await typeFor(id)).toBeNull();
    }
    mockDay = null;
    expect(await typeFor(PRAYER_ID.FAJR)).toBeNull();
  });

  it("offers nothing on a device that cannot schedule alarms", async () => {
    mockSupported = false;
    expect(await typeFor(PRAYER_ID.FAJR)).toBeNull();
    expect(await typeFor(PRAYER_ID.DHUHR)).toBeNull();
  });
});
