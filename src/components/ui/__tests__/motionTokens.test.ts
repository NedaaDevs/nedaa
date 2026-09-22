import { readFileSync } from "fs";
import { join } from "path";

// Importing tamagui.config.ts runs createTamagui(), so the durations are read from source.
const source = () => readFileSync(join(__dirname, "../../../../tamagui.config.ts"), "utf8");

const timing = (name: string) => {
  const match = source().match(
    new RegExp(`\\b${name}:\\s*\\{[^}]*type:\\s*"timing"[^}]*duration:\\s*(\\d+)`)
  );
  return match ? Number(match[1]) : null;
};

/** The four steps a screen picks between. */
const DURATIONS = { quick: 160, settle: 220, gentle: 280, sky: 720 } as const;

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
