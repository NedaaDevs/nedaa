import { readFileSync } from "fs";
import { join } from "path";

import { DURATION_MS, SPRING } from "@/constants/Motion";

// Importing tamagui.config.ts runs createTamagui(), so the durations are read from source.
const source = () => readFileSync(join(__dirname, "../../../../tamagui.config.ts"), "utf8");

/** The duration a timing token takes, resolved through `DURATION_MS`. */
const timing = (name: string) => {
  const match = source().match(
    new RegExp(`\\b${name}:\\s*\\{[^}]*type:\\s*"timing"[^}]*duration:\\s*DURATION_MS\\.(\\w+)`)
  );
  return match ? DURATION_MS[match[1] as keyof typeof DURATION_MS] : null;
};

/** The steps a screen picks between; `press` is a finger landing. */
const DURATIONS = { press: 80, quick: 160, settle: 220, gentle: 280, sky: 720 } as const;

/** The config's spring preset, read from source like the timings. */
const spring = (name: string) => {
  const match = source().match(new RegExp(`\\b${name}:\\s*\\{([^}]*type:\\s*"spring"[^}]*)\\}`));
  return match ? match[1] : null;
};

describe("spring presets", () => {
  it("settle is 300 / 30 / 1", () => {
    expect(SPRING.SETTLE).toEqual({ stiffness: 300, damping: 30, mass: 1 });
  });

  it("snap is 500 / 32 / 0.8", () => {
    expect(SPRING.SNAP).toEqual({ stiffness: 500, damping: 32, mass: 0.8 });
  });

  // Reanimated and Tamagui must agree, so the config reads the same constants.
  it("springSnap is fed by SPRING.SNAP", () => {
    expect(spring("springSnap")).toMatch(/\.\.\.SPRING\.SNAP\b/);
  });

  it("keeps settle as the 220ms timing", () => {
    expect(timing("settle")).toBe(220);
  });
});

describe("motion tokens", () => {
  it.each(Object.entries(DURATIONS))("%s runs %ims", (name, ms) => {
    expect(timing(name)).toBe(ms);
  });

  // Tamagui loads this config in Node at build time. A react-native import here
  // makes the whole config fail to load, which surfaces as "Missing themes".
  it("imports nothing from react-native", () => {
    expect(source()).not.toMatch(/from "react-native"/);
  });
});
