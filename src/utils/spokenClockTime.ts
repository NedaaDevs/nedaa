import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { TFunction } from "i18next";

import { AppLocale } from "@/enums/app";
import { clockFormat } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";

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
  { from: 0, period: "night" },
  { from: 4, period: "morning" },
  { from: 12, period: "noon" },
  { from: 15, period: "afternoon" },
  { from: 18, period: "evening" },
] as const;
type DayPeriod = (typeof PERIOD_OF_HOUR)[number]["period"];

const periodOf = (hour: number): DayPeriod =>
  PERIOD_OF_HOUR.filter(({ from }) => hour >= from).at(-1)?.period ?? "night";

const inWords = (hour: number, minute: number, t: TFunction): string => {
  const words = {
    hour: t(`a11y.time.hours.${hour % NOON || NOON}`),
    period: t(`a11y.time.periods.${periodOf(hour)}`),
  };
  return minute === 0
    ? t("a11y.time.onTheHour", words)
    : t("a11y.time.inWords", { ...words, minutes: t("a11y.time.minutes", { count: minute }) });
};

// A time for a screen reader, decided in `timezone` like the drawn time.
export const spokenClockTime = (
  date: string | Date,
  timezone: string,
  options: { locale: AppLocale; use24HourTime: boolean; western: boolean },
  t: TFunction
): string => {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  const digits = (text: string) => localizeDigits(text, options.locale, options.western);
  if (SPOKEN_IN_WORDS.includes(options.locale)) {
    const hour = Number(formatInTimeZone(parsed, timezone, HOUR_OF_DAY));
    return inWords(hour, Number(formatInTimeZone(parsed, timezone, MINUTE)), t);
  }
  if (options.use24HourTime) return digits(formatInTimeZone(parsed, timezone, clockFormat(true)));

  const time = digits(formatInTimeZone(parsed, timezone, BARE_12_HOUR));
  const afternoon = Number(formatInTimeZone(parsed, timezone, HOUR_OF_DAY)) >= NOON;
  return t(afternoon ? "a11y.time.pm" : "a11y.time.am", { time });
};
