import { useTranslation } from "react-i18next";

import { useStoredDays } from "@/hooks/useStoredDays";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { formatClockParts, formatPrayerTime } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { spokenClockTime } from "@/utils/spokenClockTime";

/** A clock time as drawn and as a screen reader says it. */
export type ClockTime = { shown: string; spoken: string };

/** A clock time that can also be drawn as a figure with its period apart. */
export type ClockFace = ClockTime & { figure: string; period: string };

/** Writes a moment in the reader's clock and digits, and says it in words. */
export const useClockTime = () => {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const use24HourTime = usePreferencesStore((state) => state.use24HourTime);
  const western = usePreferencesStore((state) => state.useWesternNumerals);
  const days = useStoredDays();

  return (time: Date, timezone: string): ClockFace => {
    const options = { locale, use24HourTime };
    const parts = formatClockParts(time, timezone, options);
    return {
      shown: localizeDigits(formatPrayerTime(time, timezone, options), locale, western),
      figure: localizeDigits(parts.figure, locale, western),
      period: parts.period,
      spoken: spokenClockTime(time, timezone, { ...options, western, days }, t),
    };
  };
};
