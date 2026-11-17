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
type Rule = {
  concept: string;
  shows: RegExp;
  drawsWith: RegExp;
  home?: string;
  within?: RegExp;
  /** A source that shows the value without its renderer. */
  fails?: string;
};

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
  // About and the Settings root end with the same version and build line.
  {
    concept: "the version and build line",
    shows: /<(Debug)?VersionLine\b|\bappVersionLabel\(\)|\bAPP_NAME_LATIN\b/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<(Debug)?VersionLine\b/,
    home: "components/about/VersionLine.tsx",
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
  // The Appearance rows, the day button and Today's upgrade card show a
  // mode's swatch; the day run's track paints each phase as its own segment.
  {
    concept: "a mode's sky swatch",
    shows: /\bskySwatchFor\(/,
    within: /^(app|components)\/(?!onboarding\/flow\/DayRunTrack\.tsx$).*\.tsx$/,
    drawsWith: /<SkySwatch\b/,
    home: "components/ui/sky-preview/index.tsx",
  },
  // Every look of the Athkar reader shows the same counts and the same place:
  // it takes the session, and reads no count or index from the store itself.
  {
    concept: "a session's counts and place",
    shows:
      /\bcurrentProgress\b|\bcurrentAthkarIndex\b|\bAthkar(Look|Focus)Props\b|\buseAthkarSession\b/,
    within: /^components\/athkar\/(looks|session)\//,
    drawsWith:
      /^(?![\s\S]*\b(currentProgress|currentAthkarIndex)\b)[\s\S]*(\buseAthkarSession\(|\bAthkar(Look|Focus)Props\b)/,
    home: "hooks/useAthkarSession.ts",
    fails: "({ session }: AthkarLookProps) => useAthkarStore((s) => s.currentProgress)",
  },
  // The reader and Focus wear the look a person chose, never one by name.
  {
    concept: "the Athkar reader's look",
    shows: /\/looks\/\w+\/look"|<\w+\.(Reader|Focus)\b/,
    within: /^(app|components|hooks)\//,
    drawsWith: /\buseAthkarLook\(|\bATHKAR_LOOKS\[/,
    home: "components/athkar/looks/registry.ts",
  },
  // The Classic reader and its Focus stage draw the place with the same marks.
  {
    concept: "the Classic look's session position",
    shows: /\bsession\.marks\b/,
    within: /^components\/athkar\/looks\/classic\//,
    drawsWith: /<ClassicPosition(Marks)?\b/,
    home: "components/athkar/looks/classic/ClassicPosition.tsx",
  },
  // The Horizon reader and its Focus stage draw the place on the same arc.
  {
    concept: "the Horizon look's session position",
    shows: /\bsession\.marks\b/,
    within: /^components\/athkar\/looks\/horizon\//,
    drawsWith: /<HorizonArc\b/,
    home: "components/athkar/looks/horizon/HorizonArc.tsx",
  },
  // The Subha reader and its Focus stage draw the place with the same knots.
  {
    concept: "the Subha look's session position",
    shows: /\bsession\.marks\b/,
    within: /^components\/athkar\/looks\/subha\//,
    drawsWith: /<SubhaKnots\b/,
    home: "components/athkar/looks/subha/SubhaKnots.tsx",
    fails: "<SessionMarks marks={session.marks} />",
  },
  // The Subha reader and its Focus stage count on the same string of beads.
  {
    concept: "the Subha look's repeats",
    shows: /\bbeads(On|Across)\(|<SubhaString\b/,
    within: /^components\/athkar\/looks\/subha\//,
    drawsWith: /<SubhaString\b/,
    home: "components/athkar/looks/subha/SubhaString.tsx",
    fails: "const lit = beadsAcross(count, target);",
  },
  // The Subha reader and its Focus stage mark each round with the same dots.
  {
    concept: "the Subha look's rounds",
    shows: /\btensOf\(|<SubhaTens\b/,
    within: /^components\/athkar\/looks\/subha\//,
    drawsWith: /<SubhaTens\b/,
    home: "components/athkar/looks/subha/SubhaTens.tsx",
    fails: "const { dots, lit } = tensOf(count, target);",
  },
  // Every look's Focus stage writes the count, its change and target alike.
  {
    concept: "a Focus stage's count",
    shows: /\bstage\.(change|targetLine)\b|<FocusCount\b/,
    within: /^components\/athkar\/looks\/(?!classic\/)/,
    drawsWith: /<FocusCount\b/,
    home: "components/athkar/session/FocusCount.tsx",
    fails: "<Text>{stage.targetLine}</Text>",
  },
  // The Horizon and Subha readers write the count and undo on one line.
  {
    concept: "a reader's count line and undo",
    shows: /athkar\.session\.undo\b|athkar\.focus\.ofTarget\b|<ReaderCount\b/,
    within: /^components\/athkar\/looks\/(?!classic\/)/,
    drawsWith: /<ReaderCount\b/,
    fails: '<Button.Text>{t("athkar.session.undo")}</Button.Text>',
  },
  // The Horizon and Subha readers end on the same Focus and audio controls.
  {
    concept: "a reader's Focus and audio controls",
    shows: /athkar\.session\.focus\.title\b|a11y\.athkar\.startAudioSession\b|<ReaderFoot\b/,
    within: /^components\/athkar\/looks\/(?!classic\/)/,
    drawsWith: /<ReaderFoot\b/,
    fails: '<Text>{t("athkar.session.focus.title")}</Text>',
  },
  // Each look's reader names the next dhikr on the same line.
  {
    concept: "the dhikr that opens next",
    shows: /athkar\.focus\.next\b|\bathkarLine\(|\bsession\.next\b/,
    within: /^components\/athkar\/looks\//,
    drawsWith: /<NextDhikr\b/,
    home: "components/athkar/session/NextDhikr.tsx",
  },
  // The reader and Focus end a session on the same card.
  {
    concept: "a session's ending",
    shows: /athkar\.session\.done\b/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<SessionDone\b/,
    home: "components/athkar/session/SessionDone.tsx",
  },
  // Today and the style previews draw Today's head, bowl or row, alike.
  {
    concept: "Today's head in its style",
    shows: /\bTODAY_STYLE\.(BOWL|SIMPLE)\b|<CelestialRhythm\b/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<TodayHero\b/,
    home: "components/today/TodayHero.tsx",
  },
  // Every route's sky holds still while another screen covers it.
  {
    concept: "a route screen's sky",
    shows: /<(SkyBackground|ScreenSky)\b/,
    within: /^app\/.*\.tsx$/,
    drawsWith: /<ScreenSky\b/,
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
    concept: "a clock time a screen reader speaks",
    shows:
      /\buseClockTime\(|\b(formatPrayerTime|toLocaleTimeString)\([\s\S]*\baccessibilityLabel\b|\baccessibilityLabel\b[\s\S]*\b(formatPrayerTime|toLocaleTimeString)\(/,
    within: /\.tsx$/,
    drawsWith: /\bspokenClockTime\(|\buseClockTime\(/,
    home: "utils/spokenClockTime.ts",
  },
  // Today's card and the prayer's sheet name the prayer and its time alike.
  {
    concept: "a prayer card's name and time",
    shows: /\bprayerCards\(/,
    within: /\.tsx$/,
    drawsWith: /\busePrayerCardText\(/,
    home: "hooks/usePrayerCardText.ts",
  },
  // A screen reading why the device read failed offers the one way out.
  {
    concept: "the way out of a failed place or times fetch",
    shows: /\blocationDetails\.error\b|\bLOCATION_FAILURE\b|\blocation\.failure\./,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<LocationFailureOffer\b/,
    home: "components/location/LocationFailureOffer.tsx",
  },
  // Today and Location both say why Makkah's times stand in, and draw it alike.
  {
    concept: "the stand-in times notice",
    shows: /\btoday\.defaultLocation\.(body|awaitingTimes)\b|<StandInNotice\b/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<StandInNotice\b/,
    home: "components/location/StandInNotice.tsx",
  },
  // A screen naming how old a location fix is computes it by the one rule.
  {
    concept: "the age of a location fix",
    shows: /\bfixAgeOf\(|\bcompass\.locationSavedAge\b|\blocation\.device\.lastFound\b/,
    within: /^(app|components)\//,
    drawsWith: /\bfixAgeOf\(/,
    home: "utils/fixAge.ts",
  },
  // A screen naming whose place the times are for paints it on the one hero.
  {
    concept: "the place hero",
    shows: /\bPLACE_HERO_(TONE|PAINT)\b/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<PlaceHero\b/,
    home: "components/ui/place-hero/index.tsx",
  },
  // Today's notice slot and the Location screen draw the one city offer.
  {
    concept: "the city-change offer",
    shows: /\bcityOffer\b/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<CityChangeOffer\b/,
    home: "components/location/CityChangeOffer.tsx",
  },
  // The reader's ring and the Focus orbit hold the count at the target's width.
  {
    concept: "a dhikr's count, held at its target's width",
    shows: /\bDigitSizer\b|<CountFigure\b/,
    within: /^components\/athkar\//,
    drawsWith: /<CountFigure\b/,
    home: "components/athkar/looks/classic/CountFigure.tsx",
  },
  // The offer and Today's zone note say a clock difference in the same words.
  {
    concept: "the zone difference between two places",
    shows: /\buseZone(?:Line|Note)\(|\bzoneDifferenceMinutes\(|\blocation\.zone\./,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /\buseZone(?:Line|Note)\(/,
    home: "hooks/useZoneLine.ts",
  },
  // Location, the city offer and onboarding's picker show a run's steps.
  {
    concept: "the steps of a location update",
    shows: /\blocation\.update\.(step|steps|failed)\.|\buseLocationUpdate\(\)/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<LocationUpdateProgress\b/,
    home: "components/LocationUpdateProgress.tsx",
  },
  // Settings › Appearance and the day run's player say a mode and its phase.
  {
    concept: "the appearance kicker and phase note",
    shows: /\bsettings\.themes\.(preview|phases)\.|\bappearancePreview\(/,
    within: /^(app|components|hooks)\//,
    drawsWith: /\bappearancePreview\(/,
    home: "utils/appearancePreview.ts",
  },
  // A file using the run's math or DAY_RUN, or holding a phase or clock
  // provider and a timer in one file, plays the day through DaySimulator.
  {
    concept: "the day passing",
    shows:
      /<DaySimulator\b|\bdayRun(Schedule|ClockAt|PhaseStartMs|LengthMs)\(|\bDAY_RUN\[|<(PhaseContext|SimulatedClockContext)\b[\s\S]*\bset(Timeout|Interval)\(|\bset(Timeout|Interval)\([\s\S]*<(PhaseContext|SimulatedClockContext)\b/,
    within: /^(app|components|hooks)\//,
    drawsWith: /<DaySimulator\b/,
    home: "components/today/DaySimulator.tsx",
  },
  // A file that plays a sound sample draws SoundPreview. The four files
  // `within` leaves out draw their own control through useSoundPreview.
  {
    concept: "a sound's play and stop control",
    shows:
      /\bsoundPreviewManager\.playSource\(|\bpreviewSource\b|\buseSoundPreview\(|<SoundPreviewButton\b/,
    within:
      /^(?!app\/settings\/qada\.tsx$|components\/(NotificationQuickSetup|PrayerCustomizationModal|alarm\/SoundPicker)\.tsx$)(app|components|hooks)\//,
    drawsWith: /<SoundPreview\b/,
    home: "components/ui/sound-preview/index.tsx",
  },
];

const FILES = sources(SRC).map((path) => ({
  path: relative(SRC, path),
  text: readFileSync(path, "utf8"),
}));

describe.each(ONE_RENDERER)("$concept", ({ shows, drawsWith, home, within, fails }) => {
  const showing = FILES.filter(
    ({ path, text }) => path !== home && (within?.test(path) ?? true) && shows.test(text)
  );

  it("is shown somewhere, so this rule still guards something", () => {
    expect(showing.length).toBeGreaterThan(0);
  });

  if (fails !== undefined) {
    it("catches a source that shows it without its renderer", () => {
      expect(shows.test(fails) && !drawsWith.test(fails)).toBe(true);
    });
  }

  it("is drawn by its one renderer wherever it is shown", () => {
    expect(showing.filter(({ text }) => !drawsWith.test(text)).map(({ path }) => path)).toEqual([]);
  });
});
