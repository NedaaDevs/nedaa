import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useTranslation } from "react-i18next";

import { useTodayClock } from "@/hooks/useTodayClock";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { HijriNative, getDateLocale } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { HIJRI_NO_OFFSET } from "@/utils/hijriAdjustment";

/** Today's two dates as the app writes them. */
export type TodayDates = { hijri: string; gregorian: string };

/** Today's Hijri and Gregorian dates in the location's day, Hijri moved by
 * `offset` days, or by the saved correction when none is given. */
export const useTodayDates = (offset?: number): TodayDates => {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const savedOffset = useAppStore((state) => state.hijriDaysOffset);
  const useWesternNumerals = usePreferencesStore((state) => state.useWesternNumerals);
  const timezone = useLocationStore((state) => state.locationDetails.timezone);
  // Re-renders on the minute so the dates turn over at midnight; a store
  // screenshot holds its seeded moment instead.
  const now = useTodayClock();

  const days = offset ?? savedOffset;
  const digits = (text: string) => localizeDigits(text, locale, useWesternNumerals);
  const zonedNow = toZonedTime(now, timezone);
  const dateLocale = getDateLocale(locale);

  // hijri-native reads Unix seconds.
  const today = HijriNative.fromTimestamp(Math.floor(now.getTime() / 1000), timezone);
  const hijri = days === HIJRI_NO_OFFSET ? today : HijriNative.addDays(today, days);

  return {
    hijri: digits(`${hijri.day} ${t(`hijriMonths.${hijri.month - 1}`)} ${hijri.year}`),
    gregorian: t("today.gregorianDate", {
      day: format(zonedNow, "EEEE", { locale: dateLocale }),
      date: digits(format(zonedNow, "d MMMM yyyy", { locale: dateLocale })),
    }),
  };
};
