import { OBSERVANCES, MONTH_NOTES } from "@/constants/Observances";
import en from "@/localization/locales/en.json";
import ar from "@/localization/locales/ar.json";
import ur from "@/localization/locales/ur.json";
import ms from "@/localization/locales/ms.json";

const LOCALES = { en, ar, ur, ms } as Record<string, Record<string, unknown>>;

const REQUIRED = [
  "hijriCalendar.title",
  "hijriCalendar.subtitle",
  "hijriCalendar.today",
  "hijriCalendar.legend.recommendedFast",
  "hijriCalendar.legend.fastingForbidden",
  "hijriCalendar.legend.blessedDay",
  "hijriCalendar.legend.nightWorship",
  "a11y.hijriCalendar.previousMonth",
  "a11y.hijriCalendar.nextMonth",
  "a11y.hijriCalendar.today",
  ...OBSERVANCES.map((o) => o.nameKey),
  ...OBSERVANCES.map((o) => o.rulingKey),
  // MONTH_NOTES is Partial, so its values widen to string | undefined.
  ...Object.values(MONTH_NOTES).filter((v): v is string => typeof v === "string"),
];

describe.each(Object.entries(LOCALES))("%s locale", (_name, bundle) => {
  it.each(REQUIRED)("defines %s as a non-empty string", (key) => {
    expect(typeof bundle[key]).toBe("string");
    expect((bundle[key] as string).length).toBeGreaterThan(0);
  });

  it("has seven short weekday names", () => {
    expect(Array.isArray(bundle.weekdaysShort)).toBe(true);
    expect(bundle.weekdaysShort as string[]).toHaveLength(7);
  });
});
