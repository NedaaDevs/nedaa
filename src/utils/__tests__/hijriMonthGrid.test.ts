import { buildMonthGrid, stepMonth } from "@/utils/hijriMonthGrid";
import { HIJRI_YEAR_MIN, HIJRI_YEAR_MAX } from "@/constants/Hijri";

// Real Umm al-Qura values for the months under test, so the weekday maths is
// checked against the calendar the app actually ships.
//   Rabi al-Awwal 1448: 29 days, 1st = Fri 14 Aug 2026
//   Ramadan 1448:       29 days, 1st = Mon  8 Feb 2027
const FIXTURES: Record<string, { len: number; start: [number, number, number] }> = {
  "1448-3": { len: 29, start: [2026, 8, 14] },
  "1448-9": { len: 29, start: [2027, 2, 8] },
};

jest.mock("@/utils/date", () => ({
  HijriNative: {
    getDaysInMonth: (month: number, year: number) => FIXTURES[`${year}-${month}`].len,
    toGregorian: (year: number, month: number, day: number) => {
      const f = FIXTURES[`${year}-${month}`];
      const d = new Date(f.start[0], f.start[1] - 1, f.start[2] + (day - 1));
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    },
  },
}));

describe("buildMonthGrid", () => {
  it("fills a 29-day month and pads to the first weekday", () => {
    const g = buildMonthGrid({ year: 1448, month: 3, hijriDaysOffset: 0, weekStartsOn: 0 });
    expect(g.daysInMonth).toBe(29);
    expect(g.cells).toHaveLength(29);
    // 1 Rabi al-Awwal 1448 is a Friday, so five blanks precede it in a
    // Sunday-first grid.
    expect(g.cells[0].weekday).toBe(5);
    expect(g.leadingPad).toBe(5);
  });

  it("re-pads when the week starts on Saturday", () => {
    const g = buildMonthGrid({ year: 1448, month: 3, hijriDaysOffset: 0, weekStartsOn: 6 });
    expect(g.leadingPad).toBe(6);
  });

  it("derives the weekday from the offset-adjusted date, not the raw conversion", () => {
    const plain = buildMonthGrid({ year: 1448, month: 3, hijriDaysOffset: 0, weekStartsOn: 0 });
    const shifted = buildMonthGrid({ year: 1448, month: 3, hijriDaysOffset: 1, weekStartsOn: 0 });

    // +1 offset lands each Hijri day one Gregorian day earlier, so every cell
    // moves one column left and the leading pad shrinks with it.
    expect(shifted.cells[0].gregorian.getDate()).toBe(plain.cells[0].gregorian.getDate() - 1);
    expect(shifted.cells[0].weekday).toBe(4);
    expect(shifted.leadingPad).toBe(4);
  });

  it("attaches resolved observances to the right cells", () => {
    const g = buildMonthGrid({ year: 1448, month: 3, hijriDaysOffset: 0, weekStartsOn: 0 });
    const whiteDay = g.cells.find((c) => c.hijriDay === 14);
    expect(whiteDay?.observances.map((o) => o.id)).toContain("white-days");
    expect(g.cells.find((c) => c.hijriDay === 5)?.observances).toEqual([]);
  });

  it("starts Ramadan's last ten on the 20th of a 29-day month", () => {
    const g = buildMonthGrid({ year: 1448, month: 9, hijriDaysOffset: 0, weekStartsOn: 0 });
    expect(g.cells.find((c) => c.hijriDay === 20)?.observances.map((o) => o.id)).toEqual([
      "ramadan-last-ten",
    ]);
    // 19 Ramadan 1448 is a Friday, so its blessed-day mark stays; only the
    // last ten must be absent.
    expect(g.cells.find((c) => c.hijriDay === 19)?.observances.map((o) => o.id)).toEqual([
      "friday",
    ]);
  });
});

describe("stepMonth", () => {
  it("moves within a year", () => {
    expect(stepMonth(1448, 3, 1)).toEqual({ year: 1448, month: 4 });
    expect(stepMonth(1448, 3, -1)).toEqual({ year: 1448, month: 2 });
  });

  it("rolls across the year boundary", () => {
    expect(stepMonth(1448, 12, 1)).toEqual({ year: 1449, month: 1 });
    expect(stepMonth(1448, 1, -1)).toEqual({ year: 1447, month: 12 });
  });

  it("returns null at the clamp instead of leaving the Umm al-Qura table", () => {
    expect(stepMonth(HIJRI_YEAR_MAX, 12, 1)).toBeNull();
    expect(stepMonth(HIJRI_YEAR_MIN, 1, -1)).toBeNull();
  });
});
