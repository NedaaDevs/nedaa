import { HijriNative } from "@/utils/date";
import { resolveDay } from "@/utils/observances";
import type { ObservanceDef } from "@/constants/Observances";
import { HIJRI_YEAR_MIN, HIJRI_YEAR_MAX } from "@/constants/Hijri";

export type MonthCell = {
  hijriDay: number;
  gregorian: Date;
  /** 0-6 from the adjusted date; decides which column the cell renders in. */
  weekday: number;
  observances: ObservanceDef[];
};

export type MonthGrid = {
  year: number;
  month: number;
  daysInMonth: number;
  /** Blank cells before day 1, in column order. */
  leadingPad: number;
  cells: MonthCell[];
};

export const buildMonthGrid = (args: {
  year: number;
  month: number;
  hijriDaysOffset: number;
  /** 0 = Sunday, matching Date.getDay(). */
  weekStartsOn: number;
}): MonthGrid => {
  const { year, month, hijriDaysOffset, weekStartsOn } = args;
  const daysInMonth = HijriNative.getDaysInMonth(month, year);

  const cells: MonthCell[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const g = HijriNative.toGregorian(year, month, day);
    // The user's offset moves their Hijri day boundary the opposite way in
    // Gregorian terms: +1 offset lands the day one Gregorian day earlier. The
    // weekday reads from the adjusted date because it picks the column.
    const gregorian = new Date(g.year, g.month - 1, g.day - hijriDaysOffset);
    cells.push({
      hijriDay: day,
      gregorian,
      weekday: gregorian.getDay(),
      observances: resolveDay({ hijri: { year, month, day }, gregorian, daysInMonth }),
    });
  }

  return {
    year,
    month,
    daysInMonth,
    leadingPad: (cells[0].weekday - weekStartsOn + 7) % 7,
    cells,
  };
};

/** The next or previous month, or null at the bounds of the Umm al-Qura table. */
export const stepMonth = (
  year: number,
  month: number,
  delta: 1 | -1
): { year: number; month: number } | null => {
  const index = year * 12 + (month - 1) + delta;
  const next = { year: Math.floor(index / 12), month: (index % 12) + 1 };
  if (next.year < HIJRI_YEAR_MIN || next.year > HIJRI_YEAR_MAX) return null;
  return next;
};
