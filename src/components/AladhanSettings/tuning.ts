// Types
import type { AladhanTuning, AladhanPrayerTimeName } from "@/types/providers/aladhan";

type Translate = (key: string) => string;

/** The API accepts ±30 minutes per timing. */
export const TUNING_LIMIT = 30;

/** The tunable timings, in the order they occur during the day. */
export const TUNED_PRAYERS: AladhanPrayerTimeName[] = [
  "fajr",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "sunset",
  "isha",
  "midnight",
];

// Prayers and the other timings live under different i18n namespaces.
const PRAYER_NAME_KEYS: Record<AladhanPrayerTimeName, string> = {
  fajr: "prayerTimes.fajr",
  dhuhr: "prayerTimes.dhuhr",
  asr: "prayerTimes.asr",
  maghrib: "prayerTimes.maghrib",
  isha: "prayerTimes.isha",
  sunrise: "otherTimings.sunrise",
  sunset: "otherTimings.sunset",
  midnight: "otherTimings.midnight",
  imsak: "otherTimings.imsak",
};

export const prayerNameKey = (prayer: AladhanPrayerTimeName) => PRAYER_NAME_KEYS[prayer];

export const clampTuning = (value: number) =>
  Math.max(-TUNING_LIMIT, Math.min(TUNING_LIMIT, value));

export const formatOffset = (value: number) => `${value > 0 ? "+" : ""}${value}`;

/**
 * Names which timings were adjusted and by how much, so the collapsed row says
 * "Fajr +2, Isha -3" rather than a bare count. Null when nothing is adjusted.
 */
export const summariseTuning = (tuning: AladhanTuning, t: Translate): string | null => {
  const adjusted = TUNED_PRAYERS.filter((prayer) => (tuning[prayer] ?? 0) !== 0);

  if (adjusted.length === 0) return null;

  return adjusted
    .map((prayer) => `${t(prayerNameKey(prayer))} ${formatOffset(tuning[prayer] as number)}`)
    .join(", ");
};
