import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";

import { PRAYER_ID } from "@/constants/Prayer";
import { useClockTime } from "@/hooks/useClockTime";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import type { PrayerCard } from "@/utils/prayerCards";
import { prayerNameKey } from "@/utils/prayerName";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

/** A prayer card's name and time, the same on Today and in its sheet. */
export const usePrayerCardText = () => {
  const { t } = useTranslation();
  const clock = useClockTime();

  // Friday's Dhuhr is Jumuah, by the weekday of the day's Dhuhr in its zone.
  return (card: PrayerCard, day: DayPrayerTimes) => {
    const friday = isFridayInTimeZone(parseISO(day.timings[PRAYER_ID.DHUHR]), day.timezone);
    return { name: t(prayerNameKey(card.id, friday)), ...clock(parseISO(card.time), day.timezone) };
  };
};
