import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { PLURAL_DUAL } from "@/constants/Locales";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { getDateLocale } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import type { UpcomingImportantDay } from "@/utils/importantDays";

/** A day count as drawn: a number with its unit, or one word for both. */
export type DayFigure = { value: string; unit?: string };

// Shared display formatting for Important Days (the Occasions screen + Today):
// Hijri line ("10 Muharram 1448"), expected Gregorian, and countdown labels.
export const useImportantDayFormat = () => {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.locale);
  const useWesternNumerals = usePreferencesStore((s) => s.useWesternNumerals);
  const digits = (text: string) => localizeDigits(text, locale, useWesternNumerals);

  const hijriLabel = (day: UpcomingImportantDay) =>
    digits(`${day.hijriDay} ${t(`hijriMonths.${day.hijriMonth - 1}`)} ${day.hijriYear}`);

  const expectedLabel = (date: Date) =>
    t("importantDays.expected", {
      date: digits(format(date, "dd MMMM yyyy", { locale: getDateLocale(locale) })),
    });

  // Full phrase ("in 220 days", "Tomorrow", "Today") for rows and a11y labels.
  // Whole days only: the Hijri date turns at civil midnight and awaits sighting.
  const remainingLabel = (daysRemaining: number) => {
    if (daysRemaining === 0) return t("importantDays.today");
    if (daysRemaining === 1) return t("importantDays.tomorrow");
    return t("importantDays.inDays", { count: daysRemaining });
  };

  // Bare unit word ("days") for the hero block, where the numeral stands alone.
  const daysUnit = (daysRemaining: number) => t("importantDays.days", { count: daysRemaining });

  // A numeral before the Arabic dual is wrong, so two days is its own word.
  const dayFigure = (daysRemaining: number): DayFigure => {
    if (daysRemaining === 0) return { value: t("importantDays.today") };
    if (daysRemaining === 1) return { value: t("importantDays.tomorrow") };
    if (new Intl.PluralRules(locale).select(daysRemaining) === PLURAL_DUAL) {
      return { value: t("importantDays.twoDays") };
    }
    return { value: digits(String(daysRemaining)), unit: daysUnit(daysRemaining) };
  };

  return { hijriLabel, expectedLabel, remainingLabel, daysUnit, dayFigure };
};
