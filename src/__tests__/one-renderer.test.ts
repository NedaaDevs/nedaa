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
  // Tools, Settings, the prayer sheet and the alarm screen say if it reads On.
  {
    concept: "whether an alarm reads On",
    shows: /\buseAlarmOn\b|\.enabled\s*&&\s*\w*[vV]erified|[vV]erified\w*\s*&&\s*[\w.]*\.enabled\b/,
    drawsWith: /\buseAlarmOn\(/,
    home: "hooks/useAlarmOn.ts",
  },
  // The switch and the Settings › Alarms city gate both ask if one is armed.
  {
    concept: "whether a real alarm is armed",
    shows: /\buseAlarmArmed\b|!\s*\w+\.isPreview\b/,
    within: /^(app|components|hooks)\//,
    drawsWith: /\buseAlarmArmed\(/,
    home: "hooks/useAlarmArmed.ts",
  },
  // The Hijri screen and the Calculation screen both read the day offset.
  {
    concept: "a Hijri day offset",
    shows: /\bhijriAdjustmentLabel\b|settings\.hijri\.date\.adjustments\./,
    drawsWith: /\bhijriAdjustmentLabel\(/,
    home: "utils/hijriAdjustment.ts",
  },
  // Today's header, the Hijri hero and Calculation all write today's dates.
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
  // Settings and onboarding derive the method in effect from the same reads.
  {
    concept: "the calculation choices",
    shows: /\bresolvedMethod\(|\buseCalculationChoices\(/,
    within: /^(app|components)\//,
    drawsWith: /\buseCalculationChoices\(/,
    home: "components/calculation/useCalculationChoices.ts",
  },
  // About, Welcome and the flow's loading state draw the theme's app icon.
  {
    concept: "the app icon",
    shows: /<BrandIcon\b|assets\/images\/icon\.png/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<BrandIcon\b/,
    home: "components/ui/brand-icon/index.tsx",
  },
  // Settings and onboarding offer the same languages, chosen the same way.
  {
    concept: "the language list",
    shows: /\bLANGUAGE_ORDER\b|<LanguageChoices\b/,
    within: /\.tsx$/,
    drawsWith: /<LanguageChoices\b/,
    home: "components/settings/LanguageChoices.tsx",
  },
  // Settings and onboarding offer the same appearance modes, each with its sky.
  {
    concept: "the appearance modes",
    shows: /\bAPPEARANCE_ORDER\b|<AppearanceChoices\b/,
    within: /\.tsx$/,
    drawsWith: /<AppearanceChoices\b/,
    home: "components/settings/AppearanceChoices.tsx",
  },
  // Preferences and the Appearance step offer the same Today style choice.
  {
    concept: "the Today style choice",
    shows: /todayStyle\.options\b|<TodayStyleChoices\b/,
    within: /\.tsx$/,
    drawsWith: /<TodayStyleChoices\b/,
    home: "components/settings/TodayStyleChoices.tsx",
  },
  // The location step, the prime and the fetch all open the same city picker.
  {
    concept: "the in-step city picker",
    shows: /<StepCityPicker\b|from "@\/components\/location\/(CityPicker|CoordinateEntry)"/,
    within: /^components\/onboarding\//,
    drawsWith: /<StepCityPicker\b/,
    home: "components/onboarding/flow/CityChoice.tsx",
  },
  // PrayerGrid (cells) and PrayerDetailHero (one prayer) draw their own rows.
  {
    concept: "a prayer's name and time in a row of times",
    shows:
      /\bprayerNameKey\([\s\S]*\b(useClockTime|formatPrayerTime)\(|\b(useClockTime|formatPrayerTime)\([\s\S]*\bprayerNameKey\(/,
    within:
      /^(app|components)\/(?!today\/PrayerGrid\.tsx$|prayer-detail\/PrayerDetailHero\.tsx$).*\.tsx$/,
    drawsWith: /<PrayerTimeCell\b/,
    home: "components/today/PrayerTimeCell.tsx",
  },
  // The day's timings placed by rhythmLine are drawn on the one bowl.
  {
    concept: "the day's rhythm",
    shows: /\brhythmLine\(/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<Bowl\b/,
    home: "components/today/Bowl.tsx",
  },
  // Today and the style previews draw Today's head, bowl or row, alike.
  {
    concept: "Today's head in its style",
    shows: /\bTODAY_STYLE\.(BOWL|SIMPLE)\b|<CelestialRhythm\b/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<TodayHero\b/,
    home: "components/today/TodayHero.tsx",
  },
  // The sky and Today's bowl draw the one sun, each at its own scale.
  {
    concept: "the sun",
    shows: /<SunGlyph\b|\bSUN_GLYPH\b/,
    within: /\.tsx$/,
    drawsWith: /<SunGlyph\b/,
    home: "components/ui/sky-background/SunGlyph.tsx",
  },
  // The sky and Today's bowl draw the one moon, in tonight's phase.
  {
    concept: "the moon",
    shows: /<MoonGlyph\b|\bMOON_GLYPH\b/,
    within: /\.tsx$/,
    drawsWith: /<MoonGlyph\b/,
    home: "components/ui/sky-background/MoonGlyph.tsx",
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
  // A file that calls playSource or names previewSource draws SoundPreview.
  {
    concept: "a sound's play and stop control",
    shows: /\bsoundPreviewManager\.playSource\(|\bpreviewSource\b/,
    within: /^(app|components|hooks)\//,
    drawsWith: /<SoundPreview\b/,
    home: "components/ui/sound-preview/index.tsx",
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
