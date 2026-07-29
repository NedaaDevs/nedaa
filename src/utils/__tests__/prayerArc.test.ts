import { ARC_START_DEG, ARC_SWEEP_DEG, arcPath, elapsedWindowFraction } from "@/utils/prayerArc";

const at = (iso: string) => new Date(iso);

describe("elapsedWindowFraction", () => {
  const from = at("2026-07-29T12:00:00Z");
  const to = at("2026-07-29T16:00:00Z");

  it("reports the share of the window that has elapsed", () => {
    expect(elapsedWindowFraction(from, to, at("2026-07-29T13:00:00Z"))).toBeCloseTo(0.25);
    expect(elapsedWindowFraction(from, to, at("2026-07-29T14:00:00Z"))).toBeCloseTo(0.5);
  });

  it("clamps outside the window rather than running past the arc", () => {
    expect(elapsedWindowFraction(from, to, at("2026-07-29T09:00:00Z"))).toBe(0);
    expect(elapsedWindowFraction(from, to, at("2026-07-29T20:00:00Z"))).toBe(1);
  });

  it("returns 0 for a window that is empty or inverted", () => {
    expect(elapsedWindowFraction(to, from, at("2026-07-29T14:00:00Z"))).toBe(0);
    expect(elapsedWindowFraction(from, from, at("2026-07-29T14:00:00Z"))).toBe(0);
  });

  it("spans midnight, so the pre-Fajr window works", () => {
    const isha = at("2026-07-29T20:00:00Z");
    const fajr = at("2026-07-30T04:00:00Z");
    expect(elapsedWindowFraction(isha, fajr, at("2026-07-30T00:00:00Z"))).toBeCloseTo(0.5);
  });
});

describe("arcPath", () => {
  it("starts at the lower left and sweeps clockwise over the top", () => {
    const d = arcPath(100, 100, 90, ARC_START_DEG, ARC_SWEEP_DEG);
    // 150° → left of centre and below it (SVG y grows downward).
    expect(d).toMatch(/^M 22\.0/);
    // A 240° sweep is the long way round, and 1 is the clockwise flag.
    expect(d).toContain("A 90 90 0 1 1");
  });

  it("uses the short-arc flag below 180°", () => {
    expect(arcPath(100, 100, 90, ARC_START_DEG, 90)).toContain("A 90 90 0 0 1");
  });

  it("caps the sweep short of a full turn, which one arc command cannot express", () => {
    const full = arcPath(100, 100, 90, 0, 360);
    const capped = arcPath(100, 100, 90, 0, 359.99);
    expect(full).toBe(capped);
  });
});
