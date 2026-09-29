import { nextHijriOccurrence, upcomingImportantDays } from "@/utils/importantDays";
import { IMPORTANT_DAYS, ImportantDayId } from "@/constants/ImportantDays";
import type { HijriDate } from "@/utils/date";

// Fake Hijri calendar: 12 fixed 30-day months; Gregorian epoch pinned so
// conversions are deterministic. Only the shapes the util consumes.
jest.mock("@/utils/date", () => {
  const DAYS_PER_YEAR = 360;
  const DAY_MS = 86400000;
  const serial = (d: HijriDate) => d.year * DAYS_PER_YEAR + (d.month - 1) * 30 + (d.day - 1);
  const fromSerial = (n: number): HijriDate => {
    const year = Math.floor(n / DAYS_PER_YEAR);
    const rest = n - year * DAYS_PER_YEAR;
    return { year, month: Math.floor(rest / 30) + 1, day: (rest % 30) + 1 };
  };
  let todayHijri = { year: 1448, month: 1, day: 17 };
  // The device's today falls on this civil date.
  const epochGregorian = Date.UTC(2026, 0, 1);
  const todaySerial = () => serial(todayHijri);
  return {
    __setToday: (d: HijriDate) => {
      todayHijri = d;
    },
    timeZonedNow: () => new Date(epochGregorian),
    HijriNative: {
      today: () => ({ ...todayHijri }),
      // The civil date in the zone, counted in days from the device's today.
      fromTimestamp: (seconds: number, timezone: string) => {
        const { formatInTimeZone } = jest.requireActual("date-fns-tz");
        const civil = Date.parse(formatInTimeZone(seconds * 1000, timezone, "yyyy-MM-dd"));
        return fromSerial(todaySerial() + Math.round((civil - epochGregorian) / DAY_MS));
      },
      toGregorian: (year: number, month: number, day: number) => {
        const offsetDays = serial({ year, month, day }) - todaySerial();
        const g = new Date(epochGregorian + offsetDays * DAY_MS);
        return { year: g.getUTCFullYear(), month: g.getUTCMonth() + 1, day: g.getUTCDate() };
      },
      addDays: (d: HijriDate, n: number) => fromSerial(serial(d) + n),
      // Matches hijri-native's real convention: days FROM a TO b (b - a).
      differenceInDays: (a: HijriDate, b: HijriDate) => serial(b) - serial(a),
    },
  };
});

const dateMock = jest.requireMock("@/utils/date") as {
  __setToday: (d: HijriDate) => void;
};
const TZ = "Asia/Riyadh";

describe("nextHijriOccurrence", () => {
  it("finds an occasion later this Hijri year", () => {
    dateMock.__setToday({ year: 1448, month: 1, day: 17 });
    const r = nextHijriOccurrence({ hijriMonth: 9, hijriDay: 1, timezone: TZ });
    expect(r.hijriYear).toBe(1448);
    // 17 Muharram → 1 Ramadan in the 30-day fake calendar: (9-1)*30 - 16 = 224
    expect(r.daysRemaining).toBe(224);
  });
  it("rolls over to next Hijri year when the date has passed", () => {
    dateMock.__setToday({ year: 1448, month: 10, day: 5 });
    const r = nextHijriOccurrence({ hijriMonth: 9, hijriDay: 1, timezone: TZ });
    expect(r.hijriYear).toBe(1449);
  });
  it("returns 0 days when today IS the occasion (no rollover)", () => {
    dateMock.__setToday({ year: 1448, month: 9, day: 1 });
    const r = nextHijriOccurrence({ hijriMonth: 9, hijriDay: 1, timezone: TZ });
    expect(r.hijriYear).toBe(1448);
    expect(r.daysRemaining).toBe(0);
  });
  it("applies hijriDaysOffset like the converter (offset shifts the user's today)", () => {
    dateMock.__setToday({ year: 1448, month: 8, day: 30 });
    // offset +1: user's calendar already reads 1 Ramadan → 0 days remaining
    const r = nextHijriOccurrence({
      hijriMonth: 9,
      hijriDay: 1,
      timezone: TZ,
      hijriDaysOffset: 1,
    });
    expect(r.daysRemaining).toBe(0);
  });
});

describe("upcomingImportantDays", () => {
  it("returns all six registry occasions sorted soonest-first", () => {
    dateMock.__setToday({ year: 1448, month: 1, day: 17 });
    const list = upcomingImportantDays({ timezone: TZ });
    expect(list).toHaveLength(IMPORTANT_DAYS.length);
    const days = list.map((o) => o.daysRemaining);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
    // Ashura (1/10) passed on 1448-01-17 → rolls to 1449, so Ramadan is first.
    expect(list[0].id).toBe(ImportantDayId.RAMADAN);
  });

  // Today's clock can be a simulated or seeded moment, not the device's.
  it("reads today from the moment it is given", () => {
    dateMock.__setToday({ year: 1448, month: 1, day: 17 });
    // Four civil days after the device's today, in Riyadh.
    const list = upcomingImportantDays({ timezone: TZ, now: new Date("2026-01-05T09:00:00Z") });

    expect(list[0]).toMatchObject({ id: ImportantDayId.RAMADAN, daysRemaining: 220 });
  });

  it("gives Today its two nearest occasions from the head of the list", () => {
    dateMock.__setToday({ year: 1448, month: 1, day: 17 });
    // 1448-01-17 plus 318 days is 1448-12-05.
    const now = new Date(Date.UTC(2026, 0, 1 + 318, 9));
    const nearest = upcomingImportantDays({ timezone: TZ, now }).slice(0, 2);

    expect(nearest.map(({ id, daysRemaining }) => ({ id, daysRemaining }))).toEqual([
      { id: ImportantDayId.ARAFAH, daysRemaining: 4 },
      { id: ImportantDayId.EID_AL_ADHA, daysRemaining: 5 },
    ]);
  });

  it.each([
    [1, 0],
    [-1, 2],
  ])("shifts the day given by the user's offset of %i", (hijriDaysOffset, expected) => {
    dateMock.__setToday({ year: 1448, month: 8, day: 29 });
    // The day after the device's today: 30 Sha'ban before the offset.
    const now = new Date("2026-01-02T09:00:00Z");
    const ramadan = upcomingImportantDays({ timezone: TZ, hijriDaysOffset, now }).find(
      ({ id }) => id === ImportantDayId.RAMADAN
    );

    expect(ramadan?.daysRemaining).toBe(expected);
  });

  // 21:00 UTC is midnight in Riyadh and still the evening before in UTC.
  it.each([
    ["2026-01-01T20:59:00Z", TZ, 1],
    ["2026-01-01T21:00:00Z", TZ, 0],
    ["2026-01-01T21:00:00Z", "UTC", 1],
  ])("at %s in %s puts Ramadan %i days away", (instant, timezone, expected) => {
    dateMock.__setToday({ year: 1448, month: 8, day: 30 });
    const ramadan = upcomingImportantDays({ timezone, now: new Date(instant) }).find(
      ({ id }) => id === ImportantDayId.RAMADAN
    );

    expect(ramadan?.daysRemaining).toBe(expected);
  });
});
