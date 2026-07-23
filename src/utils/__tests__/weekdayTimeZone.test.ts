import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

describe("isFridayInTimeZone", () => {
  // 2026-07-24T00:30:00Z is Friday in Riyadh (UTC+3 → Fri 03:30) but still
  // Thursday in Honolulu (UTC-10 → Thu 14:30). The device-getDay() check would
  // agree or disagree depending on the runner's zone; the zone-aware check must not.
  const boundary = new Date("2026-07-24T00:30:00Z");

  it("is Friday in a zone where the local weekday is Friday", () => {
    expect(isFridayInTimeZone(boundary, "Asia/Riyadh")).toBe(true);
  });

  it("is not Friday in a zone where the local weekday is still Thursday", () => {
    expect(isFridayInTimeZone(boundary, "Pacific/Honolulu")).toBe(false);
  });

  it("recognizes a plain Friday", () => {
    // Midday UTC on 2026-07-24 — Friday nearly everywhere.
    expect(isFridayInTimeZone(new Date("2026-07-24T12:00:00Z"), "Asia/Riyadh")).toBe(true);
  });

  it("rejects a plain Thursday", () => {
    expect(isFridayInTimeZone(new Date("2026-07-23T12:00:00Z"), "Asia/Riyadh")).toBe(false);
  });

  it("falls back without throwing on an invalid time zone", () => {
    expect(typeof isFridayInTimeZone(boundary, "Not/AZone")).toBe("boolean");
  });
});
