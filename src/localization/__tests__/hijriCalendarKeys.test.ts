import { OBSERVANCES, MONTH_NOTES } from "@/constants/Observances";
import en from "@/localization/locales/en.json";
import ar from "@/localization/locales/ar.json";
import ur from "@/localization/locales/ur.json";
import ms from "@/localization/locales/ms.json";

type Bundle = Record<string, unknown>;

/** Keys every locale carries. */
const SHARED = [
  "hijriCalendar.title",
  "hijriCalendar.today",
  "hijriCalendar.legend.recommendedFast",
  "hijriCalendar.legend.fastingForbidden",
  "hijriCalendar.legend.blessedDay",
  "hijriCalendar.legend.nightWorship",
  "a11y.hijriCalendar.previousMonth",
  "a11y.hijriCalendar.nextMonth",
  "a11y.hijriCalendar.today",
  // MONTH_NOTES is Partial, so its values widen to string | undefined.
  ...Object.values(MONTH_NOTES).filter((v): v is string => typeof v === "string"),
];

/** Keys the source locales carry; Crowdin fills the others, which fall back to English. */
const SOURCE = [
  ...SHARED,
  ...OBSERVANCES.map((o) => o.nameKey),
  ...OBSERVANCES.map((o) => o.rulingKey),
  "a11y.hijriCalendar.cellDate",
  "a11y.hijriCalendar.changeOffset",
  "a11y.hijriCalendar.monthSpan",
  "a11y.hijriCalendar.yearAh",
  "hijriCalendar.change",
  "hijriCalendar.dayTitle",
  "hijriCalendar.markedAs",
  "hijriCalendar.monthCaption",
  "hijriCalendar.monthSpan",
  "hijriCalendar.nothingMarked",
  "hijriCalendar.offsetLine",
  "hijriCalendar.rangeEnd",
  "hijriCalendar.rangeStart",
  "hijriCalendar.sighting",
  "hijriCalendar.thisMonth",
  "hijriCalendar.yearAh",
];

const LOCALES: [string, Bundle, readonly string[]][] = [
  ["en", en, SOURCE],
  ["ar", ar, SOURCE],
  ["ur", ur, SHARED],
  ["ms", ms, SHARED],
];

describe.each(LOCALES)("%s locale", (_name, bundle, required) => {
  it.each(required)("defines %s as a non-empty string", (key) => {
    expect(typeof bundle[key]).toBe("string");
    expect((bundle[key] as string).length).toBeGreaterThan(0);
  });

  it("has seven short weekday names", () => {
    expect(Array.isArray(bundle.weekdaysShort)).toBe(true);
    expect(bundle.weekdaysShort as string[]).toHaveLength(7);
  });
});
