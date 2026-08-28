import { OBSERVANCES, MONTH_NOTES } from "@/constants/Observances";
import { ObservanceClass, ObservanceId } from "@/enums/observances";

describe("OBSERVANCES registry", () => {
  it("has one entry per known id, with no duplicates", () => {
    const ids = OBSERVANCES.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(Object.values(ObservanceId)));
  });

  it("only uses Hijri months in 1-12 and days in 1-30", () => {
    for (const o of OBSERVANCES) {
      const r = o.recurrence;
      if (r.kind === "weekday") {
        expect(r.weekdays.every((w) => w >= 0 && w <= 6)).toBe(true);
        continue;
      }
      if (r.kind === "hijri-monthly") {
        expect(r.days.every((d) => d >= 1 && d <= 30)).toBe(true);
        continue;
      }
      expect(r.month).toBeGreaterThanOrEqual(1);
      expect(r.month).toBeLessThanOrEqual(12);
      if (r.kind === "hijri-fixed") expect(r.day).toBeLessThanOrEqual(30);
      if (r.kind === "hijri-range") expect(r.from).toBeLessThanOrEqual(r.to);
      if (r.kind === "hijri-last-n") expect(r.count).toBeGreaterThan(0);
    }
  });

  it("gives every entry a name key and a ruling key", () => {
    for (const o of OBSERVANCES) {
      expect(o.nameKey).toMatch(/^hijriCalendar\.observances\./);
      expect(o.rulingKey).toMatch(/^hijriCalendar\.rulings\./);
      expect(Object.values(ObservanceClass)).toContain(o.observanceClass);
    }
  });

  it("marks exactly the three prohibitions", () => {
    const forbidden = OBSERVANCES.filter(
      (o) => o.observanceClass === ObservanceClass.FASTING_FORBIDDEN
    ).map((o) => o.id);
    expect(new Set(forbidden)).toEqual(
      new Set([ObservanceId.EID_AL_FITR, ObservanceId.EID_AL_ADHA, ObservanceId.AYYAM_AL_TASHREEQ])
    );
  });

  it("notes only months whose recommendations have no fixed dates", () => {
    expect(
      Object.keys(MONTH_NOTES)
        .map(Number)
        .sort((a, b) => a - b)
    ).toEqual([1, 8, 9, 10, 12]);
  });
});
