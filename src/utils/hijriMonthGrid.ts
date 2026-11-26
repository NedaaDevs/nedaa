import { HijriNative } from "@/utils/date";
import { resolveDay } from "@/utils/observances";
import type { ObservanceDef } from "@/constants/Observances";
import { HIJRI_MONTHS_PER_YEAR, HIJRI_YEAR_MAX, HIJRI_YEAR_MIN } from "@/constants/Hijri";

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

export type HijriYearMonth = { year: number; month: number };

/** Months since 1 Muharram of year 0, so months compare and step as numbers. */
export const hijriMonthIndex = ({ year, month }: HijriYearMonth) =>
  year * HIJRI_MONTHS_PER_YEAR + (month - 1);

const fromMonthIndex = (index: number): HijriYearMonth => ({
  year: Math.floor(index / HIJRI_MONTHS_PER_YEAR),
  month: (index % HIJRI_MONTHS_PER_YEAR) + 1,
});

/** The next or previous month, or null at the bounds of the Umm al-Qura table. */
export const stepMonth = (year: number, month: number, delta: 1 | -1): HijriYearMonth | null => {
  const next = fromMonthIndex(hijriMonthIndex({ year, month }) + delta);
  if (next.year < HIJRI_YEAR_MIN || next.year > HIJRI_YEAR_MAX) return null;
  return next;
};

/** The month itself, or the table's first or last month when it lies outside. */
export const clampHijriMonth = (target: HijriYearMonth): HijriYearMonth => {
  if (target.year < HIJRI_YEAR_MIN) return { year: HIJRI_YEAR_MIN, month: 1 };
  if (target.year > HIJRI_YEAR_MAX) return { year: HIJRI_YEAR_MAX, month: HIJRI_MONTHS_PER_YEAR };
  return { year: target.year, month: target.month };
};
