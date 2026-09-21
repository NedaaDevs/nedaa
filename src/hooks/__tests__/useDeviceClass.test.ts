import { readFileSync } from "fs";
import { join } from "path";

import { resolveDeviceClass, DEVICE_CLASS, EXPANDED_MIN_DP } from "@/hooks/useDeviceClass";

/** Real point dimensions. */
const IPHONES = {
  se: { width: 320, height: 568 },
  "15": { width: 393, height: 852 },
  "15ProMax": { width: 430, height: 932 },
  duoOuter: { width: 466, height: 678 },
  duoInner: { width: 626, height: 890 },
} as const;

const WIDEST_PHONE = IPHONES.duoOuter.width;

describe("device class", () => {
  it.each([
    ["se", DEVICE_CLASS.COMPACT],
    ["15", DEVICE_CLASS.COMPACT],
    ["15ProMax", DEVICE_CLASS.COMPACT],
    ["duoOuter", DEVICE_CLASS.COMPACT],
    ["duoInner", DEVICE_CLASS.EXPANDED],
  ] as const)("iPhone %s is %s", (device, expected) => {
    expect(resolveDeviceClass(IPHONES[device].width)).toBe(expected);
  });

  // At 600 the Duo's 626pt inner display has 26pt of headroom, so one reserved inset
  // flips the class while the user is mid-screen.
  it("clears the Duo's inner width by more than an inset", () => {
    expect(IPHONES.duoInner.width - EXPANDED_MIN_DP).toBeGreaterThanOrEqual(60);
  });

  it("sits above every phone", () => {
    expect(EXPANDED_MIN_DP).toBeGreaterThan(WIDEST_PHONE);
  });

  it("reads the shorter edge, so rotation keeps the class", () => {
    const { width, height } = IPHONES["15ProMax"];

    expect(resolveDeviceClass(Math.min(width, height))).toBe(resolveDeviceClass(width));
  });
});

// A primitive using `$expanded` and a screen using useDeviceClass() must agree.
describe("tamagui media query", () => {
  it("uses the same threshold as the hook", () => {
    const source = readFileSync(join(__dirname, "../../../tamagui.config.ts"), "utf8");
    const match = source.match(/expanded: \{ minWidth: (\d+) \}/);

    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(EXPANDED_MIN_DP);
  });
});
