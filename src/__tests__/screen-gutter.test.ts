import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";
import { getTokenValue } from "tamagui";

import config from "../../tamagui.config";

const SRC = join(__dirname, "..");

/** Every source file under src/, tests excluded. */
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sources(path);
    return /\.tsx$/.test(entry.name) ? [path] : [];
  });

/** The scroll view's own home, which defines it rather than scrolling. */
const HOME = "components/ui/sky-background/";

/** Centred welcome copy holds its own wider measure, not a column. */
const OWN_MEASURE = new Set(["components/onboarding/flow/steps/WelcomeStep.tsx"]);

/** Files that scroll a screen on the sky. */
const SKY_SCREENS = sources(SRC)
  .map((path) => [relative(SRC, path), readFileSync(path, "utf8")] as const)
  .filter(([path, text]) => !path.startsWith(HOME) && /<SkyScrollView\b/.test(text))
  .filter(([path]) => !OWN_MEASURE.has(path));

/** The props Tamagui reads as a horizontal inset, by long name or shorthand. */
const INSET_PROPS = [
  "paddingHorizontal",
  "px",
  "paddingStart",
  "paddingEnd",
  "paddingLeft",
  "pl",
  "paddingRight",
  "pr",
];

/** The space tokens named for the screen's gutter and a group's inset. */
const GUTTER_NAMES = ["screen", "group"] as const;

/** Those gutters' widths, in points. */
const GUTTERS = GUTTER_NAMES.map((name) => getTokenValue(`$${name}`, "space"));

/** The named gutters and the numbered space steps of the same width. */
const GUTTER_TOKENS = [
  ...GUTTER_NAMES,
  ...Object.entries(config.tokens.space)
    .filter(([name, { val }]) => /^\d+$/.test(name) && GUTTERS.includes(val))
    .map(([name]) => name),
];

/** A horizontal gutter set by hand, as a token or in points. */
const HAND_GUTTER = new RegExp(
  `\\b(${INSET_PROPS.join("|")})=("\\$(${GUTTER_TOKENS.join("|")})"|\\{(${GUTTERS.join("|")})\\})`
);

describe("hand gutter rule", () => {
  it.each([
    'paddingHorizontal="$4"',
    'px="$group"',
    'paddingStart="$screen"',
    "paddingEnd={16}",
    'pl="$4"',
    'pr="$5"',
    "paddingRight={20}",
  ])("sees %s", (prop) => {
    expect(prop).toMatch(HAND_GUTTER);
  });

  // An inner row's own inset is not the screen's column.
  it("passes an inner row's inset", () => {
    expect('paddingHorizontal="$3"').not.toMatch(HAND_GUTTER);
  });
});

// A sky screen's header takes the screen gutter, so its content must too.
describe("screen gutter", () => {
  it("finds the sky screens", () => {
    expect(SKY_SCREENS.length).toBeGreaterThan(10);
  });

  it.each(SKY_SCREENS)("%s sets its content in the shared column", (_path, text) => {
    expect(text).toMatch(/<ScreenContent\b/);
  });

  it.each(SKY_SCREENS)("%s pads no column by hand", (_path, text) => {
    expect(text).not.toMatch(HAND_GUTTER);
  });
});
