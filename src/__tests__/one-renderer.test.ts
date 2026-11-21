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
type Source = { path: string; text: string };

type Rule = {
  concept: string;
  shows: RegExp;
  drawsWith: RegExp;
  home?: string;
  within?: RegExp;
  /** Sources the row covers that show the value without its renderer. */
  fails?: Source | readonly Source[];
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
  // Screen headers and the wake-up task lead back with the same link.
  {
    concept: "a back link to the previous place",
    shows: /\ba11y\.backTo\b/,
    drawsWith: /<BackLink\b/,
    home: "components/ui/screen-header/back-link.tsx",
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
      /^(?![\s\S]*\b(currentProgress|currentAthkarIndex)\b)[\s\S]*(\buseAthkarSession\(|\bAthkar(Look|Focus)Props\b|\bsession: AthkarSession\b)/,
    home: "hooks/useAthkarSession.ts",
    fails: {
      path: "components/athkar/looks/fixture/FixtureReader.tsx",
      text: "({ session }: AthkarLookProps) => useAthkarStore((s) => s.currentProgress)",
    },
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
    fails: {
      path: "components/athkar/looks/subha/Fixture.tsx",
      text: "<SessionMarks marks={session.marks} />",
    },
  },
  // The Subha reader and its Focus stage count on the same string of beads.
  {
    concept: "the Subha look's repeats",
    shows: /\bbeads(On|Across)\(|<SubhaString\b/,
    within: /^components\/athkar\/looks\/subha\//,
    drawsWith: /<SubhaString\b/,
    home: "components/athkar/looks/subha/SubhaString.tsx",
    fails: {
      path: "components/athkar/looks/subha/Fixture.tsx",
      text: "const lit = beadsAcross(count, target);",
    },
  },
  // The Subha reader and its Focus stage mark each round with the same dots.
  {
    concept: "the Subha look's rounds",
    shows: /\btensOf\(|<SubhaTens\b/,
    within: /^components\/athkar\/looks\/subha\//,
    drawsWith: /<SubhaTens\b/,
    home: "components/athkar/looks/subha/SubhaTens.tsx",
    fails: {
      path: "components/athkar/looks/subha/Fixture.tsx",
      text: "const { dots, lit } = tensOf(count, target);",
    },
  },
  // Every look's Focus stage writes the count, its change and target alike.
  {
    concept: "a Focus stage's count",
    shows: /\bstage\.(change|targetLine)\b|<FocusCount\b/,
    within: /^components\/athkar\/looks\/(?!classic\/)/,
    drawsWith: /<FocusCount\b/,
    home: "components/athkar/session/FocusCount.tsx",
    fails: {
      path: "components/athkar/looks/fixture/FixtureFocus.tsx",
      text: "<Text>{stage.targetLine}</Text>",
    },
  },
  // The Horizon and Subha readers and Focus stages write the place alike.
  {
    concept: "a session's place in figures",
    shows: /\b(reader|stage)\.figures\b|<SessionFigures\b/,
    within: /^components\/athkar\/looks\/(?!classic\/)/,
    drawsWith: /<SessionFigures\b/,
    home: "components/athkar/session/SessionFigures.tsx",
    fails: {
      path: "components/athkar/looks/fixture/FixtureReader.tsx",
      text: "<Text>{reader.figures}</Text>",
    },
  },
  // The Horizon and Subha readers write the count and undo on one line.
  {
    concept: "a reader's count line and undo",
    shows: /athkar\.session\.undo\b|athkar\.focus\.ofTarget\b|<ReaderCount\b/,
    within: /^components\/athkar\/looks\/(?!classic\/)/,
    drawsWith: /<ReaderCount\b/,
    fails: {
      path: "components/athkar/looks/fixture/FixtureReader.tsx",
      text: '<Button.Text>{t("athkar.session.undo")}</Button.Text>',
    },
  },
  // The Horizon and Subha readers end on the same Focus and audio controls.
  {
    concept: "a reader's Focus and audio controls",
    shows: /athkar\.session\.focus\.title\b|a11y\.athkar\.startAudioSession\b|<ReaderFoot\b/,
    within: /^components\/athkar\/looks\/(?!classic\/)/,
    drawsWith: /<ReaderFoot\b/,
    fails: {
      path: "components/athkar/looks/fixture/FixtureReader.tsx",
      text: '<Text>{t("athkar.session.focus.title")}</Text>',
    },
  },
  // Each look's reader names the next dhikr on the same line.
  {
    concept: "the dhikr that opens next",
    shows: /athkar\.focus\.next\b|\bathkarLine\(|\bsession\.next\b/,
    within: /^components\/athkar\/looks\//,
    drawsWith: /<NextDhikr\b/,
    home: "components/athkar/session/NextDhikr.tsx",
  },
  // A dhikr is a locale key or a person's own words; one resolver reads both.
  // Words drawn or spoken straight from `arabicText` skip it.
  {
    concept: "a dhikr's words",
    shows: /\bDhikrText\b|\bsplitAthkarText\(|\{\s*[\w.]+\.arabicText\s*\}\s*<\//,
    within: /^(components|hooks)\//,
    drawsWith:
      /^(?![\s\S]*(\b(splitAthkarText|resolveDhikrText)\(|\{\s*[\w.]+\.arabicText\s*\}\s*<\/|accessibilityLabel=\{[\w.]+\.arabicText\}))[\s\S]*(\buseDhikrText\(|\btext=\{|\btext: DhikrText\b)/,
    home: "hooks/useDhikrText.ts",
    fails: {
      path: "components/athkar/Fixture.tsx",
      text: "const words = splitAthkarText(t(item.text), locale)",
    },
  },
  // Morning, evening, a saved topic and a custom group count through a port.
  {
    concept: "a collection's count",
    shows: /\b(incrementCount(By)?|decrementCount)\b|\bcollectionSession\.\w+\(/,
    within: /^(app|components|hooks)\//,
    drawsWith: /\bSessionPort\b/,
    fails: {
      path: "components/athkar/Fixture.tsx",
      text: "const add = useMyAthkarStore((s) => s.incrementCount)",
    },
  },
  // Every source holds a finished dhikr for the same pause before it moves.
  {
    concept: "the pause before the next dhikr",
    shows: /\bADVANCE_PAUSE_MS\b|\bcreateAdvance\(/,
    within: /^(?!constants\/)/,
    drawsWith: /\bcreateAdvance\(/,
    home: "utils/athkarSession.ts",
    fails: {
      path: "stores/fixture.ts",
      text: "setTimeout(() => moveOn(), ADVANCE_PAUSE_MS)",
    },
  },
  // The reader and Focus end a session on the same card.
  {
    concept: "a session's ending",
    shows: /athkar\.session\.(done|collectionDone)\b/,
    within: /^(app|components)\/.*\.tsx$/,
    // A screen hands its line to the reader or to Focus, which draw the card.
    drawsWith: /<SessionDone\b|\bdoneMessage=/,
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
  // The Qada home, its batches and the batch sheet name a batch the same way.
  {
    concept: "a Qada batch's name, date added and days left",
    shows: /\buseBatchText\b|\bqada\.batch\.(unnamed|done|addedOn|addedToday)\b/,
    drawsWith: /\buseBatchText\(/,
    home: "hooks/useBatchText.ts",
    fails: { path: "components/qada/Fixture.tsx", text: 't("qada.batch.unnamed")' },
  },
  // A batch's date added and a recorded day read as the same Hijri day. Keyed on
  // the row's stamp, so formatting it any other way still counts as showing it.
  {
    concept: "a Qada row's day",
    shows: /\.created_at\b|\bdayLabelOf\(/,
    within: /^(app|components|hooks)\//,
    drawsWith: /\buseQadaDayText\(/,
    home: "hooks/useQadaDayText.ts",
    fails: {
      path: "components/qada/Fixture.tsx",
      text: "new Date(day.created_at).toLocaleDateString()",
    },
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
  {
    concept: "a wake-up board's answer card",
    shows: /\bANSWER_CARD_STATE\b/,
    within: /^components\/.*\.tsx$/,
    drawsWith: /<AnswerCard\b/,
    home: "components/alarm/challenges/AnswerCard.tsx",
    fails: {
      path: "components/alarm/challenges/Fixture.tsx",
      text: '<Box borderColor={state === ANSWER_CARD_STATE.WRONG ? "$danger" : "$fg"} />',
    },
  },
  // The task picker and the alarm guide both say when the way out appears.
  {
    concept: "the way out's sentence",
    shows: /\balarm\.task\.wayOutAfter\b|\bwayOutSentence\(/,
    within: /^(app|components|hooks)\//,
    drawsWith: /\bwayOutSentence\(/,
    home: "utils/taskClock.ts",
    fails: {
      path: "components/alarm/Fixture.tsx",
      text: 't("alarm.task.wayOutAfter", { count: 2 })',
    },
  },
  // The task shell runs the quiet time the alarm guide states.
  {
    concept: "a task's quiet time length",
    shows: /\bQUIET_TIME_SECONDS\b|\bquietSecondsFor\(/,
    within: /^(app|components|hooks)\//,
    drawsWith: /\bquietSecondsFor\(/,
    home: "utils/taskClock.ts",
    fails: {
      path: "components/alarm/Fixture.tsx",
      text: "screenReader ? QUIET_TIME_SECONDS.SCREEN_READER : QUIET_TIME_SECONDS.DEFAULT",
    },
  },
  // The ringing screen and the task offer the emergency quiet alike.
  {
    concept: "the emergency quiet offer",
    shows: /<EmergencyQuiet\b|\balarm\.quiet\.(button|noneLeft|confirm)\b|\bquietOfferFor\(/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<EmergencyQuiet\b/,
    home: "components/alarm/challenges/EmergencyQuiet.tsx",
    fails: { path: "components/alarm/Fixture.tsx", text: 't("alarm.quiet.button")' },
  },
  // Both show the running quiet and the time the alarm rings again alike.
  {
    concept: "the running emergency quiet",
    shows: /<QuietBanner\b|\balarm\.quiet\.banner\b/,
    within: /^(app|components)\/.*\.tsx$/,
    drawsWith: /<QuietBanner\b/,
    home: "components/alarm/challenges/QuietBanner.tsx",
    fails: { path: "components/alarm/Fixture.tsx", text: 't("alarm.quiet.banner", { time })' },
  },
  // The ringing screen and the stopped panel read the alarm's prayer alike.
  {
    concept: "an alarm's prayer time",
    shows: new RegExp(
      [
        /\balarm\.solved\.(began|begins)\b|\ba11y\.alarm\.ringingAt\b/.source,
        // A ring's time read against the stored days picks the prayer anew.
        /\btriggerTime\b[\s\S]*\b(today|tomorrow)Timings\b/.source,
        /\b(today|tomorrow)Timings\b[\s\S]*\btriggerTime\b/.source,
      ].join("|")
    ),
    within: /^(app|components|hooks)\//,
    drawsWith: /\buseAlarmPrayer\(/,
    home: "hooks/useAlarmPrayer.ts",
    fails: [
      {
        path: "components/alarm/Fixture.tsx",
        text: 't("alarm.solved.began", { prayer, time })',
      },
      {
        path: "hooks/useFixture.ts",
        text: [
          "const at = useAlarmStore((s) => s.getAlarm(id)?.triggerTime);",
          "const day = usePrayerTimesStore((s) => s.todayTimings);",
          't("alarm.types.fajr");',
        ].join("\n"),
      },
      {
        path: "components/alarm/OtherFixture.tsx",
        text: 'const day = tomorrowTimings;\nconst at = record.triggerTime;\nt("alarm.snoozed");',
      },
    ],
  },
];

const FILES: readonly Source[] = sources(SRC).map((path) => ({
  path: relative(SRC, path),
  text: readFileSync(path, "utf8"),
}));

/** The files a rule covers that show its value without its renderer. */
const unrendered = ({ shows, drawsWith, home, within }: Rule, files: readonly Source[]) =>
  files
    .filter(
      ({ path, text }) =>
        path !== home && (within?.test(path) ?? true) && shows.test(text) && !drawsWith.test(text)
    )
    .map(({ path }) => path);

describe.each(ONE_RENDERER)("$concept", (rule) => {
  const { shows, home, within, fails } = rule;

  it("is shown somewhere, so this rule still guards something", () => {
    const showing = FILES.filter(
      ({ path, text }) => path !== home && (within?.test(path) ?? true) && shows.test(text)
    );
    expect(showing.length).toBeGreaterThan(0);
  });

  if (fails !== undefined) {
    it.each([fails].flat())("catches $path, shown without its renderer", (fixture) => {
      expect(unrendered(rule, [fixture])).toEqual([fixture.path]);
    });
  }

  it("is drawn by its one renderer wherever it is shown", () => {
    expect(unrendered(rule, FILES)).toEqual([]);
  });
});
