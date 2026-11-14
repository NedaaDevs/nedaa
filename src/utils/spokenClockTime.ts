import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { TFunction } from "i18next";

import { DAY_PERIOD, type DayPeriod } from "@/constants/Accessibility";
import { OTHER_TIMING } from "@/constants/Prayer";
import { AppLocale } from "@/enums/app";
import { clockFormat } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { type StoredDays, storedDayOn } from "@/utils/phase";

// The 12-hour clock without its period, and the hour that decides the period.
const BARE_12_HOUR = "h:mm";
const HOUR_OF_DAY = "H";
const NOON = 12;
const MINUTE = "m";

// iOS Arabic speech rewrites any clock digits with its own period word, so
// these locales speak the hour in words that speech leaves alone.
const SPOKEN_IN_WORDS: readonly AppLocale[] = [AppLocale.AR];

// The part of the day each hour belongs to, as Arabic names it.
const PERIOD_OF_HOUR = [
  { from: 0, period: DAY_PERIOD.NIGHT },
  { from: 4, period: DAY_PERIOD.MORNING },
  { from: 12, period: DAY_PERIOD.NOON },
  { from: 15, period: DAY_PERIOD.AFTERNOON },
  { from: 18, period: DAY_PERIOD.EVENING },
] as const;

// Whether a time is past its own day's sunset, read in that day's zone only.
const pastSunset = (date: Date, timezone: string, days: StoredDays) => {
  const day = storedDayOn(date, days);
  return day?.timezone === timezone && date >= parseISO(day.otherTimings[OTHER_TIMING.SUNSET]);
};

// Asr ends at sunset, so an afternoon past it is evening. Before noon the clock
// decides, as the sun can set that early near the poles.
const periodOf = (date: Date, hour: number, timezone: string, days: StoredDays = {}) =>
  hour >= NOON && pastSunset(date, timezone, days)
    ? DAY_PERIOD.EVENING
    : (PERIOD_OF_HOUR.findLast(({ from }) => hour >= from)?.period ?? DAY_PERIOD.NIGHT);

const inWords = (hour: number, minute: number, period: DayPeriod, t: TFunction): string => {
  const words = {
    hour: t(`a11y.time.hours.${hour % NOON || NOON}`),
    period: t(`a11y.time.periods.${period}`),
  };
  return minute === 0
    ? t("a11y.time.onTheHour", words)
    : t("a11y.time.inWords", { ...words, minutes: t("a11y.time.minutes", { count: minute }) });
};

// A time for a screen reader, decided in `timezone` like the drawn time.
export const spokenClockTime = (
  date: string | Date,
  timezone: string,
  options: { locale: AppLocale; use24HourTime: boolean; western: boolean; days?: StoredDays },
  t: TFunction
): string => {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  const digits = (text: string) => localizeDigits(text, options.locale, options.western);
  if (SPOKEN_IN_WORDS.includes(options.locale)) {
    const hour = Number(formatInTimeZone(parsed, timezone, HOUR_OF_DAY));
    const minute = Number(formatInTimeZone(parsed, timezone, MINUTE));
    return inWords(hour, minute, periodOf(parsed, hour, timezone, options.days), t);
  }
  if (options.use24HourTime) return digits(formatInTimeZone(parsed, timezone, clockFormat(true)));

  const time = digits(formatInTimeZone(parsed, timezone, BARE_12_HOUR));
  const afternoon = Number(formatInTimeZone(parsed, timezone, HOUR_OF_DAY)) >= NOON;
  return t(afternoon ? "a11y.time.pm" : "a11y.time.am", { time });
};
