import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

const SRC = join(__dirname, "..");

/** Every source file under src/, tests excluded. */
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

// A value two screens show must look and move alike, so it has one renderer:
// each row names what marks a file showing it, the renderer it must use, and
// the renderer's own file, which defines it rather than draws with it.
type Rule = { concept: string; shows: RegExp; drawsWith: RegExp; home?: string };

const ONE_RENDERER: readonly Rule[] = [
  { concept: "a prayer's count figure", shows: /\bformatCount\(/, drawsWith: /<Countdown\b/ },
  // More and the Settings root both show which alarms are on.
  {
    concept: "the alarms that are on",
    shows: /\buseAlarmStatus\b|tools\.alarm\.statusOff/,
    drawsWith: /\buseAlarmStatus\(/,
    home: "hooks/useAlarmStatus.ts",
  },
  // The Hijri screen and the Settings root both read the day offset.
  {
    concept: "a Hijri day offset",
    shows: /\bhijriAdjustmentLabel\b|settings\.hijri\.date\.adjustments\./,
    drawsWith: /\bhijriAdjustmentLabel\(/,
    home: "utils/hijriAdjustment.ts",
  },
];

const FILES = sources(SRC).map((path) => ({
  path: relative(SRC, path),
  text: readFileSync(path, "utf8"),
}));

describe.each(ONE_RENDERER)("$concept", ({ shows, drawsWith, home }) => {
  const showing = FILES.filter(({ path, text }) => path !== home && shows.test(text));

  it("is shown somewhere, so this rule still guards something", () => {
    expect(showing.length).toBeGreaterThan(0);
  });

  it("is drawn by its one renderer wherever it is shown", () => {
    expect(showing.filter(({ text }) => !drawsWith.test(text)).map(({ path }) => path)).toEqual([]);
  });
});
