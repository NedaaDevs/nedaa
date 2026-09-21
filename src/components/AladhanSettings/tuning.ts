// Constants
import { PRAYER_ID } from "@/constants/Prayer";

// Types
import type { AladhanTuning, AladhanPrayerTimeName } from "@/types/providers/aladhan";

// Utils
import { formatNumberToLocale } from "@/utils/number";

type Translate = (key: string) => string;

/** The API accepts ±30 minutes per timing. */
export const TUNING_LIMIT = 30;

/** The tunable timings, in the order they occur during the day. */
export const TUNED_PRAYERS: AladhanPrayerTimeName[] = [
  PRAYER_ID.FAJR,
  "sunrise",
  PRAYER_ID.DHUHR,
  PRAYER_ID.ASR,
  PRAYER_ID.MAGHRIB,
  "sunset",
  PRAYER_ID.ISHA,
  "midnight",
];

// Prayers and the other timings live under different i18n namespaces.
const PRAYER_NAME_KEYS: Record<AladhanPrayerTimeName, string> = {
  [PRAYER_ID.FAJR]: "prayerTimes.fajr",
  [PRAYER_ID.DHUHR]: "prayerTimes.dhuhr",
  [PRAYER_ID.ASR]: "prayerTimes.asr",
  [PRAYER_ID.MAGHRIB]: "prayerTimes.maghrib",
  [PRAYER_ID.ISHA]: "prayerTimes.isha",
  sunrise: "otherTimings.sunrise",
  sunset: "otherTimings.sunset",
  midnight: "otherTimings.midnight",
  imsak: "otherTimings.imsak",
};

export const prayerNameKey = (prayer: AladhanPrayerTimeName) => PRAYER_NAME_KEYS[prayer];

export const clampTuning = (value: number) =>
  Math.max(-TUNING_LIMIT, Math.min(TUNING_LIMIT, value));

export const formatOffset = (value: number) => `${value > 0 ? "+" : ""}${value}`;

// A directional isolate keeps the sign beside its digits inside Arabic text, where
// bidi would otherwise reorder the run.
const isolateLtr = (text: string) => `⁦${text}⁩`;

/** "Fajr +2 · Isha -3" for the collapsed row. Null when nothing is adjusted. */
export const summariseTuning = (tuning: AladhanTuning, t: Translate): string | null => {
  const adjusted = TUNED_PRAYERS.filter((prayer) => (tuning[prayer] ?? 0) !== 0);

  if (adjusted.length === 0) return null;

  return adjusted
    .map((prayer) => {
      const offset = formatNumberToLocale(formatOffset(tuning[prayer] as number));
      return `${t(prayerNameKey(prayer))} ${isolateLtr(offset)}`;
    })
    .join(" · ");
};
