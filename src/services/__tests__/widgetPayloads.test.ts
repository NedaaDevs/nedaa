import { buildImportantDaysPayload, buildHijriTodayPayload } from "@/services/widgetPayloads";
import { IMPORTANT_DAYS } from "@/constants/ImportantDays";

// widgetPayloads.ts also imports the app/location stores (for the writer); stub
// their persistence layer so importing the module doesn't hit native SQLite.
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

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

describe("buildImportantDaysPayload", () => {
  it("emits soonest-first entries with iso dates and localized names", () => {
    const t = ((k: string) => `L(${k})`) as never;
    const list = buildImportantDaysPayload(t, "Asia/Riyadh", 0);
    expect(list.length).toBe(IMPORTANT_DAYS.length);
    expect(list[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.stringMatching(/^L\(importantDays\./),
        hijriLabel: expect.any(String),
        dateISO: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
    );
    const days = list.map((d) => d.dateISO);
    expect([...days].sort()).toEqual(days);
  });
});

describe("buildHijriTodayPayload", () => {
  it("labels today with hijri day/month/year", () => {
    const t = ((k: string) => `L(${k})`) as never;
    const p = buildHijriTodayPayload(t, "Asia/Riyadh", 0);
    expect(p.hijriLabel).toContain("L(hijriMonths.0)"); // month 1 in the fixed mock (17 Muharram)
  });
});
