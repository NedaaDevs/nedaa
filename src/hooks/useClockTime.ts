import { useTranslation } from "react-i18next";

import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { formatPrayerTime } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { spokenClockTime } from "@/utils/spokenClockTime";

/** A clock time as drawn and as a screen reader says it. */
export type ClockTime = { shown: string; spoken: string };

/** Writes a moment in the reader's clock and digits, and says it in words. */
export const useClockTime = () => {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const use24HourTime = usePreferencesStore((state) => state.use24HourTime);
  const western = usePreferencesStore((state) => state.useWesternNumerals);

  return (time: Date, timezone: string): ClockTime => ({
    shown: localizeDigits(
      formatPrayerTime(time, timezone, { locale, use24HourTime }),
      locale,
      western
    ),
    spoken: spokenClockTime(time, timezone, { locale, use24HourTime, western }, t),
  });
};
