import { useTranslation } from "react-i18next";

import { useTodayClock } from "@/hooks/useTodayClock";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { HijriNative, type HijriDate } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { HIJRI_NO_OFFSET } from "@/utils/hijriAdjustment";
import { dayLabelOf } from "@/utils/qadaDays";

/** A Qada row's day: whether it is today, and how it reads. */
export type QadaDayText = { today: boolean; text: string };

/** Writes a stored instant as its Hijri day in the location's zone: «اليوم», «25 صفر», or with the year when it is not this year's. */
export const useQadaDayText = () => {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const offset = useAppStore((state) => state.hijriDaysOffset);
  const western = usePreferencesStore((state) => state.useWesternNumerals);
  const timezone = useLocationStore((state) => state.locationDetails.timezone);
  const now = useTodayClock();

  // hijri-native reads Unix seconds.
  const hijriAt = (ms: number): HijriDate => {
    const date = HijriNative.fromTimestamp(Math.floor(ms / 1000), timezone);
    return offset === HIJRI_NO_OFFSET ? date : HijriNative.addDays(date, offset);
  };
  const today = hijriAt(now.getTime());

  return (iso: string): QadaDayText => {
    const label = dayLabelOf(hijriAt(Date.parse(iso)), today);
    if (label.today) return { today: true, text: t("hijriCalendar.today") };
    const parts = [String(label.day), t(`hijriMonths.${label.month - 1}`)];
    if (label.year !== undefined) parts.push(String(label.year));
    return { today: false, text: localizeDigits(parts.join(" "), locale, western) };
  };
};
