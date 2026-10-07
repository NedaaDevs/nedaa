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
// `within` limits a row to the files it matches, such as the .tsx that draw.
type Rule = { concept: string; shows: RegExp; drawsWith: RegExp; home?: string; within?: RegExp };

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
  // Today's header and the Hijri screen's hero both write today's dates.
  {
    concept: "today's Hijri and Gregorian dates",
    shows: /\btoday\.gregorianDate\b|\buseTodayDates\b/,
    drawsWith: /\buseTodayDates\(/,
    home: "hooks/useTodayDates.ts",
  },
  // The launch announcement and the About list both draw What's New entries.
  {
    concept: "a What's New entry",
    shows: /\buseWhatsNew\(\)|import[^;]*\bWhatsNewEntry\b[^;]*from/,
    drawsWith: /<ReleaseNoteCard\b|<ReleaseNotesList\b/,
    home: "components/whats-new/ReleaseNoteCard.tsx",
  },
  // The About card and the release notes both mark the installed version.
  {
    concept: "the installed version",
    shows: /\bappVersion\(\)/,
    within: /\.tsx$/,
    drawsWith: /<VersionPill\b/,
    home: "components/whats-new/VersionPill.tsx",
  },
  // The page sky and the Appearance previews paint one scene the same way.
  {
    concept: "the app's sky",
    shows: /\bsky(Scene|SceneFor|SwatchFor|BackgroundImage)\(/,
    within: /\.tsx$/,
    drawsWith: /<SkyPaint\b|<SkySwatch\b/,
    home: "components/ui/sky-background/SkyPaint.tsx",
  },
  // Today, More, the Settings root and the Language hero all name the place.
  {
    concept: "the user's place",
    shows: /\blocalizedLocation\b|\busePlace\(/,
    within: /^(app|components|hooks)\//,
    drawsWith: /\busePlace\(/,
    home: "hooks/usePlace.ts",
  },
  // Today's focus block and the Language hero name the same prayer.
  {
    concept: "the focus prayer's name",
    shows: /\buseCountdownTimer\(|\buseFocusPrayer\(|today\.focus\.(next|current)/,
    drawsWith: /\buseFocusPrayer\(/,
    home: "hooks/useFocusPrayer.ts",
  },
  // The tab bar and the opening-tab choice offer the same tabs, named alike.
  {
    concept: "the bar's tabs",
    shows: /\bTabBarItem\b|\bsetOpeningTab\b/,
    within: /\.tsx$/,
    drawsWith: /\buseBarTabs\(/,
    home: "components/ui/tab-bar-item/index.tsx",
  },
  // The Text size preview and onboarding set text at a preset not yet chosen.
  {
    concept: "text at a preset other than the app's",
    shows: /\bTEXT_SIZE_MULTIPLIERS\[/,
    within: /\.tsx$/,
    drawsWith: /<TextScaleContext\b/,
  },
  // A screen reader says «م» as morning, so a spoken time names its period.
  {
    concept: "a prayer time a screen reader speaks",
    shows:
      /\bformatPrayerTime\([\s\S]*\baccessibilityLabel\b|\baccessibilityLabel\b[\s\S]*\bformatPrayerTime\(/,
    within: /\.tsx$/,
    drawsWith: /\bspokenClockTime\(/,
    home: "utils/spokenClockTime.ts",
  },
];

const FILES = sources(SRC).map((path) => ({
  path: relative(SRC, path),
  text: readFileSync(path, "utf8"),
}));

describe.each(ONE_RENDERER)("$concept", ({ shows, drawsWith, home, within }) => {
  const showing = FILES.filter(
    ({ path, text }) => path !== home && (within?.test(path) ?? true) && shows.test(text)
  );

  it("is shown somewhere, so this rule still guards something", () => {
    expect(showing.length).toBeGreaterThan(0);
  });

  it("is drawn by its one renderer wherever it is shown", () => {
    expect(showing.filter(({ text }) => !drawsWith.test(text)).map(({ path }) => path)).toEqual([]);
  });
});
