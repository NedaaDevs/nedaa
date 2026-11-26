import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { OBSERVANCE_MARK } from "@/constants/ObservanceMarks";
import type { ObservanceDef } from "@/constants/Observances";
import { useDayMonth } from "@/hooks/useDayMonth";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { getDateLocale } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { isWeekly } from "@/utils/observances";
import type { MonthCell } from "@/utils/hijriMonthGrid";

/** The calendar's dates and spoken names, in the reader's digits. */
export const useHijriCalendarText = () => {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.locale);
  const western = usePreferencesStore((s) => s.useWesternNumerals);
  const dayMonth = useDayMonth();

  const digits = (value: number | string) => localizeDigits(String(value), locale, western);
  const dated = (date: Date, pattern: string) =>
    localizeDigits(format(date, pattern, { locale: getDateLocale(locale) }), locale, western);
  const monthName = (month: number) => t(`hijriMonths.${month - 1}`);
  const weekday = (date: Date) => dated(date, "EEEE");
  const yearAh = (year: number) => t("hijriCalendar.yearAh", { year: digits(year) });
  const spokenYearAh = (year: number) => t("a11y.hijriCalendar.yearAh", { year: digits(year) });
  // The template ends each sentence, so a part's own full stop is dropped.
  const sentences = (parts: string[]) =>
    parts.length === 0
      ? ""
      : parts.reduce((first, second) =>
          t("a11y.sentences", { first: first.replace(/\.\s*$/, ""), second })
        );
  const marked = (observance: ObservanceDef) =>
    t("hijriCalendar.markedAs", {
      mark: t(OBSERVANCE_MARK[observance.observanceClass].labelKey),
      name: t(observance.nameKey),
    });

  /** A cell's spoken name: its date, today, then the marks drawn on it. */
  const cellLabel = (cell: MonthCell, month: number, isToday: boolean) =>
    sentences([
      t("a11y.hijriCalendar.cellDate", {
        weekday: weekday(cell.gregorian),
        day: digits(cell.hijriDay),
        month: monthName(month),
        gregorian: dayMonth(cell.gregorian),
      }),
      ...(isToday ? [t("hijriCalendar.today")] : []),
      ...cell.observances.filter((o) => !isWeekly(o)).map(marked),
    ]);

  const dayTitle = (cell: MonthCell, month: number, year: string) =>
    t("hijriCalendar.dayTitle", {
      weekday: weekday(cell.gregorian),
      day: digits(cell.hijriDay),
      month: monthName(month),
      year,
    });

  return {
    digits,
    dated,
    monthName,
    yearAh,
    spokenYearAh,
    sentences,
    marked,
    cellLabel,
    dayTitle,
  };
};
