import { describe, expect, test } from "bun:test";
import { STORE_PLAN, fileStem, planFor, validatePlan } from "./screenshot-plan.ts";

describe("screenshot plan", () => {
  test("both platforms have contiguous, unique-screen plans", () => {
    expect(() => planFor("ios")).not.toThrow();
    expect(() => planFor("android")).not.toThrow();
  });

  test("alarms lead on Android but sit lower on iOS", () => {
    const ios = STORE_PLAN.ios.find((c) => c.screen === "reliable-alarms");
    const android = STORE_PLAN.android.find((c) => c.screen === "reliable-alarms");
    expect(android?.idx).toBe(2);
    expect(ios?.idx).toBeGreaterThan(2);
  });

  test("privacy closes both plans as the honest text cell", () => {
    for (const platform of ["ios", "android"] as const) {
      const last = STORE_PLAN[platform].at(-1);
      expect(last?.screen).toBe("privacy");
      expect(last?.variant).toBe("honest");
    }
  });

  test("quran is excluded (gated)", () => {
    for (const platform of ["ios", "android"] as const) {
      expect(STORE_PLAN[platform].some((c) => c.screen === "quran")).toBe(false);
    }
  });

  test("fileStem zero-pads the index", () => {
    expect(fileStem({ idx: 2, screen: "qibla" })).toBe("02-qibla");
  });

  test("validatePlan rejects gaps and duplicates", () => {
    expect(() => validatePlan([{ idx: 1, screen: "qibla", variant: "hero" }])).not.toThrow();
    expect(() =>
      validatePlan([
        { idx: 1, screen: "qibla", variant: "hero" },
        { idx: 3, screen: "tools", variant: "hero" },
      ])
    ).toThrow();
    expect(() =>
      validatePlan([
        { idx: 1, screen: "qibla", variant: "hero" },
        { idx: 2, screen: "qibla", variant: "hero" },
      ])
    ).toThrow();
  });
});
