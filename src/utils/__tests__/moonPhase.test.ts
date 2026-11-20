import { HijriNative } from "@/utils/date";
import { hijriDayAt, litFraction, moonPath, moonPhaseFor, moonTilt } from "@/utils/moonPhase";

jest.mock("@/utils/date", () => ({
  HijriNative: {
    fromTimestamp: jest.fn(() => ({ year: 1448, month: 4, day: 12 })),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

/** The two arcs of a moon path: the lit limb, then the terminator. */
const arcsOf = (path: string) => {
  const arcs = [...path.matchAll(/A ([\d.]+) ([\d.]+) 0 0 ([01])/g)];
  return arcs.map(([, rx, , sweep]) => ({ rx: Number(rx), sweep: Number(sweep) }));
};

describe("moonPhaseFor", () => {
  it.each([
    ["a thin crescent", 1, 0, 0.1],
    ["full", 15, 0.45, 0.55],
    ["a thin waning crescent", 29, 0.9, 1],
    ["the last, near new", 30, 0.95, 1],
  ])("reads Hijri day %s as %s", (_name, day, low, high) => {
    const phase = moonPhaseFor(day);

    expect(phase).toBeGreaterThan(low);
    expect(phase).toBeLessThan(high);
  });

  // A 30-day month must not wrap back to a waxing crescent on its last night.
  it("moves forward through every day of a month", () => {
    const phases = Array.from({ length: 30 }, (_, i) => moonPhaseFor(i + 1));

    phases.slice(1).forEach((phase, i) => expect(phase).toBeGreaterThan(phases[i]));
  });
});

describe("moonPath", () => {
  const R = 20;

  // Past the quarter the terminator bows away from the limb, filling the disc.
  it("draws the full moon as the whole disc", () => {
    const [limb, terminator] = arcsOf(moonPath(50, 50, R, 0.5, false));

    expect(terminator.rx).toBeCloseTo(R);
    expect(terminator.sweep).toBe(limb.sweep);
  });

  it("draws the quarter moon with a straight terminator", () => {
    const [, terminator] = arcsOf(moonPath(50, 50, R, 0.25, false));

    expect(terminator.rx).toBeCloseTo(0);
  });

  it("bows the terminator toward the lit limb for a crescent", () => {
    const [limb, terminator] = arcsOf(moonPath(50, 50, R, 0.1, false));

    expect(terminator.sweep).not.toBe(limb.sweep);
  });

  // The lit limb faces the sun: where it set if waxing, where it rises if waning.
  it.each([
    ["waxing, left to right", 0.1, false, 1],
    ["waxing, right to left", 0.1, true, 0],
    ["waning, left to right", 0.9, false, 0],
    ["waning, right to left", 0.9, true, 1],
  ])("lights the correct side when %s", (_name, phase, isRTL, limbSweep) => {
    const [limb] = arcsOf(moonPath(50, 50, R, phase, isRTL));

    expect(limb.sweep).toBe(limbSweep);
  });
});

describe("hijriDayAt", () => {
  const NOW = new Date("2026-09-23T20:00:00.000Z");

  // hijri-native reads Unix seconds; milliseconds land millennia out.
  it("asks for the date in Unix seconds", () => {
    hijriDayAt(NOW, "Asia/Riyadh", 0);

    expect(HijriNative.fromTimestamp).toHaveBeenCalledWith(NOW.getTime() / 1000, "Asia/Riyadh");
  });

  it("applies the user's correction", () => {
    expect(hijriDayAt(NOW, "Asia/Riyadh", -1)).toBe(11);
  });
});

describe("litFraction", () => {
  it.each([
    [0, 0],
    [0.25, 0.5],
    [0.5, 1],
    [0.75, 0.5],
  ])("lights %s of the cycle as %s of the disc", (phase, lit) => {
    expect(litFraction(phase)).toBeCloseTo(lit);
  });
});

describe("moonTilt", () => {
  // The lit limb turns to the sun below the horizon: a young moon lies horns-up.
  it.each([
    ["waxing, right to left", 0.08, true, -1],
    ["waxing, left to right", 0.08, false, 1],
    ["waning, right to left", 0.92, true, 1],
    ["waning, left to right", 0.92, false, -1],
  ])("tilts toward the sun when %s", (_name, phase, isRTL, sign) => {
    expect(Math.sign(moonTilt(phase, isRTL, 38))).toBe(sign);
  });

  it("does not tilt a full moon, which has no direction", () => {
    expect(moonTilt(0.5, true, 38)).toBeCloseTo(0);
  });
});
