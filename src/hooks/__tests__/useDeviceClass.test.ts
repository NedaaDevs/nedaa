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
    expect(resolveDeviceClass(IPHONES[device])).toBe(expected);
  });

  // At 600 the Duo's 626pt inner display has 26pt of headroom, so one reserved inset
  // flips the class while the user is mid-screen.
  it("clears the Duo's inner width by more than an inset", () => {
    expect(IPHONES.duoInner.width - EXPANDED_MIN_DP).toBeGreaterThanOrEqual(60);
  });

  it("sits above every phone", () => {
    expect(EXPANDED_MIN_DP).toBeGreaterThan(WIDEST_PHONE);
  });

  it("reads the shorter edge, so orientation does not change the class", () => {
    const { width, height } = IPHONES.duoInner;

    expect(resolveDeviceClass({ width: height, height: width })).toBe(
      resolveDeviceClass({ width, height })
    );
  });
});

/** Parses `expanded: { minWidth: N, minHeight: M }` into a predicate over a window. */
const expandedMediaMatches = (window: { width: number; height: number }): boolean => {
  const source = readFileSync(join(__dirname, "../../../tamagui.config.ts"), "utf8");
  const block = source.match(/expanded: \{([^}]*)\}/);
  if (!block) throw new Error("expanded media query not found");

  const minWidth = block[1].match(/minWidth: (\d+)/);
  const minHeight = block[1].match(/minHeight: (\d+)/);

  return (
    (!minWidth || window.width >= Number(minWidth[1])) &&
    (!minHeight || window.height >= Number(minHeight[1]))
  );
};

// A primitive styling with `$expanded` and a screen branching on useDeviceClass() must
// reach the same answer for the same window, or one renders inside the other's branch.
describe("tamagui $expanded agrees with the hook", () => {
  const WINDOWS = {
    phonePortrait: { width: 393, height: 852 },
    phoneLandscape: { width: 852, height: 393 },
    duoInnerPortrait: { width: 626, height: 890 },
    duoInnerLandscape: { width: 890, height: 626 },
    // adjustResize (AndroidManifest.xml:34) shrinks the window when the keyboard opens.
    tabletKeyboardOpen: { width: 626, height: 450 },
    iPadSplitNarrow: { width: 507, height: 1180 },
  } as const;

  it.each(Object.keys(WINDOWS) as (keyof typeof WINDOWS)[])("%s", (name) => {
    const window = WINDOWS[name];

    expect(expandedMediaMatches(window)).toBe(resolveDeviceClass(window) === DEVICE_CLASS.EXPANDED);
  });
});
