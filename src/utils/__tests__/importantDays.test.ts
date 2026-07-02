import { nextHijriOccurrence, upcomingImportantDays } from "@/utils/importantDays";
import { IMPORTANT_DAYS } from "@/constants/ImportantDays";

// Fake Hijri calendar: 12 fixed 30-day months; Gregorian epoch pinned so
// conversions are deterministic. Only the shapes the util consumes.
jest.mock("@/utils/date", () => {
  const DAYS_PER_YEAR = 360;
  const serial = (d: { year: number; month: number; day: number }) =>
    d.year * DAYS_PER_YEAR + (d.month - 1) * 30 + (d.day - 1);
  let todayHijri = { year: 1448, month: 1, day: 17 };
  const epochGregorian = Date.UTC(2026, 0, 1);
  const todaySerial = () => serial(todayHijri);
  return {
    __setToday: (d: { year: number; month: number; day: number }) => {
      todayHijri = d;
    },
    timeZonedNow: () => new Date(epochGregorian),
    HijriNative: {
      today: () => ({ ...todayHijri }),
      toGregorian: (year: number, month: number, day: number) => {
        const offsetDays = serial({ year, month, day }) - todaySerial();
        const g = new Date(epochGregorian + offsetDays * 86400000);
        return { year: g.getUTCFullYear(), month: g.getUTCMonth() + 1, day: g.getUTCDate() };
      },
      addDays: (d: { year: number; month: number; day: number }, n: number) => {
        let s = serial(d) + n;
        const year = Math.floor(s / DAYS_PER_YEAR);
        s -= year * DAYS_PER_YEAR;
        return { year, month: Math.floor(s / 30) + 1, day: (s % 30) + 1 };
      },
      // Matches hijri-native's real convention: days FROM a TO b (b - a).
      differenceInDays: (
        a: { year: number; month: number; day: number },
        b: { year: number; month: number; day: number }
      ) => serial(b) - serial(a),
    },
  };
});

const dateMock = jest.requireMock("@/utils/date") as {
  __setToday: (d: { year: number; month: number; day: number }) => void;
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
    expect(list[0].id).toBe("ramadan");
  });
});
