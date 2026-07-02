import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { useAppStore } from "@/stores/app";
import { getDateLocale } from "@/utils/date";
import { formatNumberToLocale } from "@/utils/number";
import type { UpcomingImportantDay } from "@/utils/importantDays";

// Shared display formatting for Important Days (Tools screen + Home card):
// Hijri line ("10 Muharram 1448"), expected Gregorian, and countdown labels.
export const useImportantDayFormat = () => {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.locale);

  const hijriLabel = (day: UpcomingImportantDay) =>
    `${formatNumberToLocale(String(day.hijriDay))} ${t(`hijriMonths.${day.hijriMonth - 1}`)} ${formatNumberToLocale(String(day.hijriYear))}`;

  const expectedLabel = (date: Date) =>
    t("importantDays.expected", {
      date: formatNumberToLocale(format(date, "dd MMMM yyyy", { locale: getDateLocale(locale) })),
    });

  // Full sentence ("in 220 days" / "Tomorrow" / "Today") — compact rows + a11y labels.
  // Day granularity is deliberate: the Hijri day turns at Maghrib and the date is
  // a moon-sighting estimate, so hour counts would be false precision.
  const remainingLabel = (daysRemaining: number) => {
    if (daysRemaining === 0) return t("importantDays.today");
    if (daysRemaining === 1) return t("importantDays.tomorrow");
    return formatNumberToLocale(t("importantDays.inDays", { count: daysRemaining }));
  };

  // Bare unit word ("days") for the hero block, where the numeral stands alone.
  const daysUnit = (daysRemaining: number) => t("importantDays.days", { count: daysRemaining });

  return { hijriLabel, expectedLabel, remainingLabel, daysUnit };
};
