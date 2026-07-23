import { computeNextStreak, toLocalDateISO } from "@/utils/streak";

describe("computeNextStreak", () => {
  it("starts at 1 when there is no prior success", () => {
    expect(computeNextStreak(null, "2026-07-23", 0)).toBe(1);
  });

  it("is a no-op for a second success on the same day", () => {
    expect(computeNextStreak("2026-07-23", "2026-07-23", 5)).toBe(5);
  });

  it("increments when the last success was yesterday", () => {
    expect(computeNextStreak("2026-07-22", "2026-07-23", 5)).toBe(6);
  });

  it("increments across a month boundary", () => {
    expect(computeNextStreak("2026-07-31", "2026-08-01", 3)).toBe(4);
  });

  it("increments across a year boundary", () => {
    expect(computeNextStreak("2026-12-31", "2027-01-01", 9)).toBe(10);
  });

  it("resets to 1 after a gap of two or more days", () => {
    expect(computeNextStreak("2026-07-20", "2026-07-23", 5)).toBe(1);
  });

  it("resets to 1 if the recorded date is in the future (clock moved back)", () => {
    expect(computeNextStreak("2026-07-24", "2026-07-23", 5)).toBe(1);
  });
});

describe("toLocalDateISO", () => {
  it("formats a timestamp as local YYYY-MM-DD", () => {
    const ts = new Date(2026, 6, 5, 4, 30, 0).getTime(); // 2026-07-05 04:30 local
    expect(toLocalDateISO(ts)).toBe("2026-07-05");
  });

  it("zero-pads single-digit months and days", () => {
    const ts = new Date(2026, 0, 9, 23, 59, 0).getTime(); // 2026-01-09 local
    expect(toLocalDateISO(ts)).toBe("2026-01-09");
  });
});
