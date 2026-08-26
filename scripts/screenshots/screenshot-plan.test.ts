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

  test("quran ships on both platforms, high in the carousel", () => {
    for (const platform of ["ios", "android"] as const) {
      const quran = STORE_PLAN[platform].find((c) => c.screen === "quran");
      expect(quran).toBeDefined();
      expect(quran?.idx).toBeLessThanOrEqual(3);
    }
  });

  test("android fits Play's eight-cell cap by dropping qibla", () => {
    expect(STORE_PLAN.android).toHaveLength(8);
    expect(STORE_PLAN.android.some((c) => c.screen === "qibla")).toBe(false);
    // iOS has a ten-cell cap, so it keeps qibla alongside both quran cells.
    expect(STORE_PLAN.ios).toHaveLength(10);
    expect(STORE_PLAN.ios.some((c) => c.screen === "qibla")).toBe(true);
  });

  test("ios pairs the reader in light and dark; android ships light only", () => {
    const iosQuran = STORE_PLAN.ios.filter((c) => c.screen === "quran");
    expect(iosQuran.map((c) => c.theme)).toEqual([undefined, "dark"]);
    const androidQuran = STORE_PLAN.android.filter((c) => c.screen === "quran");
    expect(androidQuran).toHaveLength(1);
  });

  test("validatePlan allows one screen in two themes but not the same theme twice", () => {
    expect(() =>
      validatePlan([
        { idx: 1, screen: "quran", variant: "hero" },
        { idx: 2, screen: "quran", variant: "hero", theme: "dark" },
      ])
    ).not.toThrow();
    expect(() =>
      validatePlan([
        { idx: 1, screen: "quran", variant: "hero", theme: "dark" },
        { idx: 2, screen: "quran", variant: "hero", theme: "dark" },
      ])
    ).toThrow();
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
