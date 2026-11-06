import { OTHER_TIME_LABEL_KEY, OTHER_TIMING, PRAYER_ID, isPrayerId } from "@/constants/Prayer";
import type { AppLocale } from "@/enums/app";
import type { AladhanPrayerTimeName, AladhanTuning } from "@/types/providers/aladhan";
import { LTR_ISOLATE, localizeDigits } from "@/utils/digits";
import { formatNumberToLocale } from "@/utils/number";

type TranslateWith = (key: string, options?: Record<string, unknown>) => string;
type TranslateCount = (key: string, options?: { count: number }) => string;

/** The API accepts ±30 minutes per timing. */
export const TUNING_LIMIT = 30;

/** The tunable timings, in the order they occur during the day. */
export const TUNED_PRAYERS: AladhanPrayerTimeName[] = [
  PRAYER_ID.FAJR,
  OTHER_TIMING.SUNRISE,
  PRAYER_ID.DHUHR,
  PRAYER_ID.ASR,
  PRAYER_ID.MAGHRIB,
  OTHER_TIMING.SUNSET,
  PRAYER_ID.ISHA,
  OTHER_TIMING.MIDNIGHT,
];

/** The five prayers among the tunable timings, which the editor lists first. */
export const TUNED_PRAYER_TIMES = TUNED_PRAYERS.filter(isPrayerId);

/** The tunable timings that are not prayers, folded under "other times". */
export const TUNED_OTHER_TIMES = TUNED_PRAYERS.filter((timing) => !isPrayerId(timing));

/** Whether a value names a tunable timing, such as a route param. */
export const isTunedTiming = (value: unknown): value is AladhanPrayerTimeName =>
  TUNED_PRAYERS.some((timing) => timing === value);

/** How many moved timings the collapsed row names before it counts the rest. */
const SUMMARY_NAMED = 2;

// Prayers and the other timings live under different i18n namespaces.
const PRAYER_NAME_KEYS: Record<AladhanPrayerTimeName, string> = {
  [PRAYER_ID.FAJR]: "prayerTimes.fajr",
  [PRAYER_ID.DHUHR]: "prayerTimes.dhuhr",
  [PRAYER_ID.ASR]: "prayerTimes.asr",
  [PRAYER_ID.MAGHRIB]: "prayerTimes.maghrib",
  [PRAYER_ID.ISHA]: "prayerTimes.isha",
  [OTHER_TIMING.SUNRISE]: OTHER_TIME_LABEL_KEY[OTHER_TIMING.SUNRISE],
  [OTHER_TIMING.SUNSET]: OTHER_TIME_LABEL_KEY[OTHER_TIMING.SUNSET],
  [OTHER_TIMING.MIDNIGHT]: OTHER_TIME_LABEL_KEY[OTHER_TIMING.MIDNIGHT],
  [OTHER_TIMING.IMSAK]: OTHER_TIME_LABEL_KEY[OTHER_TIMING.IMSAK],
};

/** A tunable timing's name key; Dhuhr stays Dhuhr, as the API tunes it. */
export const timingNameKey = (timing: AladhanPrayerTimeName) => PRAYER_NAME_KEYS[timing];

export const clampTuning = (value: number) =>
  Math.max(-TUNING_LIMIT, Math.min(TUNING_LIMIT, value));

export const formatOffset = (value: number) => `${value > 0 ? "+" : ""}${value}`;

// An isolate keeps the sign beside its digits, which Arabic bidi would reorder.
const isolateLtr = (text: string) => `${LTR_ISOLATE.OPEN}${text}${LTR_ISOLATE.CLOSE}`;

/** An offset as drawn: signed, in the locale's digits, held left to right. */
export const signedOffset = (value: number, locale: AppLocale, western: boolean) =>
  isolateLtr(localizeDigits(formatOffset(value), locale, western));

/** Whether any tunable timing moves. */
export const isTuned = (tuning: AladhanTuning | undefined) =>
  TUNED_PRAYERS.some((prayer) => (tuning?.[prayer] ?? 0) !== 0);

const adjusted = (tuning: AladhanTuning | undefined) =>
  TUNED_PRAYERS.filter((prayer) => (tuning?.[prayer] ?? 0) !== 0);

/**
 * "Fajr +2 · Isha -3" for the collapsed row, the rest counted after the first two.
 * Null when nothing is adjusted.
 */
export const summariseTuning = (
  tuning: AladhanTuning | undefined,
  t: TranslateCount
): string | null => {
  const moved = adjusted(tuning);

  if (moved.length === 0) return null;

  const named = moved.slice(0, SUMMARY_NAMED).map((prayer) => {
    const offset = formatNumberToLocale(formatOffset(tuning?.[prayer] ?? 0));
    return `${t(timingNameKey(prayer))} ${isolateLtr(offset)}`;
  });
  const rest = moved.length - named.length;
  return [
    ...named,
    ...(rest > 0 ? [t("settings.calculation.tuning.more", { count: rest })] : []),
  ].join(" · ");
};

/** One prayer's offset, counted as minutes later or earlier than calculated. */
export const summarisePrayerTuning = (
  tuning: AladhanTuning | undefined,
  prayer: AladhanPrayerTimeName,
  t: TranslateCount
): string => {
  const offset = tuning?.[prayer] ?? 0;

  if (offset === 0) return t("prayerDetail.adjustment.none");

  return t(offset > 0 ? "prayerDetail.adjustment.later" : "prayerDetail.adjustment.earlier", {
    count: Math.abs(offset),
  });
};

/** The summary as a screen reader says it: each moved timing in minutes. */
export const spokenTuning = (tuning: AladhanTuning | undefined, t: TranslateWith) => {
  const moved = adjusted(tuning);

  if (moved.length === 0) return null;

  return moved
    .map((prayer) =>
      t("a11y.join", {
        first: t(timingNameKey(prayer)),
        second: summarisePrayerTuning(tuning, prayer, t),
      })
    )
    .reduce((spoken, next) => t("a11y.join", { first: spoken, second: next }));
};
