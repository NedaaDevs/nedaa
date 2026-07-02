import { HijriNative } from "@/utils/date";
import { IMPORTANT_DAYS, type ImportantDayDef } from "@/constants/ImportantDays";

export type NextOccurrence = {
  hijriYear: number;
  daysRemaining: number;
  expectedGregorian: Date;
};

export type UpcomingImportantDay = ImportantDayDef & NextOccurrence;

// Next occurrence of a Hijri (month, day), in the USER'S Hijri calendar:
// hijriDaysOffset shifts today the same way the Hijri converter shifts its
// Gregorian→Hijri result, so both features always agree. All calendar math is
// HijriNative (OS Umm al-Qura) — dates are estimates pending moon sighting.
export const nextHijriOccurrence = (args: {
  hijriMonth: number;
  hijriDay: number;
  timezone: string;
  hijriDaysOffset?: number;
}): NextOccurrence => {
  const { hijriMonth, hijriDay, timezone, hijriDaysOffset = 0 } = args;
  const rawToday = HijriNative.today(timezone);
  const today = hijriDaysOffset !== 0 ? HijriNative.addDays(rawToday, hijriDaysOffset) : rawToday;

  const passedThisYear =
    today.month > hijriMonth || (today.month === hijriMonth && today.day > hijriDay);
  const hijriYear = passedThisYear ? today.year + 1 : today.year;
  const target = { year: hijriYear, month: hijriMonth, day: hijriDay };

  // hijri-native convention: differenceInDays(a, b) = days from a to b.
  const daysRemaining = HijriNative.differenceInDays(today, target);

  // The user's offset moves their Hijri day boundary the opposite way in
  // Gregorian terms: +1 offset ⇒ the occasion lands one Gregorian day earlier.
  const g = HijriNative.toGregorian(hijriYear, hijriMonth, hijriDay);
  const expectedGregorian = new Date(g.year, g.month - 1, g.day - hijriDaysOffset);

  return { hijriYear, daysRemaining, expectedGregorian };
};

// Registry → occurrences, soonest first.
export const upcomingImportantDays = (args: {
  timezone: string;
  hijriDaysOffset?: number;
}): UpcomingImportantDay[] =>
  IMPORTANT_DAYS.map((def) => ({
    ...def,
    ...nextHijriOccurrence({
      hijriMonth: def.hijriMonth,
      hijriDay: def.hijriDay,
      timezone: args.timezone,
      hijriDaysOffset: args.hijriDaysOffset,
    }),
  })).sort((a, b) => a.daysRemaining - b.daysRemaining);
