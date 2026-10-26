import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

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

/** A gutter set by hand, in any of the spellings Tamagui reads as one prop. */
const HAND_GUTTER =
  /\b(paddingHorizontal|px|paddingStart|paddingEnd|ps|pe)=("\$(4|group|screen)"|\{(16|20)\})/;

describe("hand gutter rule", () => {
  it.each([
    'paddingHorizontal="$4"',
    'px="$group"',
    'paddingStart="$screen"',
    "paddingEnd={16}",
    'ps="$4"',
    "pe={20}",
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
