// Constants
import { ASR_SCHOOL, MIDNIGHT_MODE, PRAYER_TIME_PROVIDERS } from "@/constants/providers";

// Stores
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { useLocationStore } from "@/stores/location";

// Types
import type {
  AladhanSettings,
  AladhanPrayerTimeName,
  AladhanTuning,
  AladhanTuningString,
  AladhanApiParams,
  AladhanApiOptions,
} from "@/types/providers/aladhan";

import { getTimezoneYear } from "@/utils/date";

/**
 * Return an api ready params
 */
export const transformAladhanParams = (yearOverride?: number, month?: number): AladhanApiParams => {
  const location = useLocationStore.getState().locationDetails;
  const settings = useProviderSettingsStore.getState().getCurrentSettings<AladhanSettings>();

  const year = yearOverride ?? getTimezoneYear(location.timezone);

  const params: AladhanApiParams = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    year,
  };

  if (month !== undefined) {
    params.month = month;
  }

  const options: AladhanApiOptions = {};
  let hasOptions = false;

  if (settings?.method !== undefined) {
    options.method = settings.method;
    hasOptions = true;
  }

  if (settings?.madhab !== undefined) {
    options.school = settings.madhab;
    hasOptions = true;
  }

  if (settings?.midnightMode !== undefined) {
    options.midnightMode = settings.midnightMode;
    hasOptions = true;
  }

  if (settings?.tune) {
    options.tune = tuningToString(settings.tune);
    hasOptions = true;
  }

  if (hasOptions) {
    params.options = options;
  }

  return params;
};

export const PRAYER_TIME_ORDER: AladhanPrayerTimeName[] = [
  "imsak",
  "fajr",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "sunset",
  "isha",
  "midnight",
];

export const tuningToString = (tuning: AladhanTuning): AladhanTuningString => {
  const values = PRAYER_TIME_ORDER.map((time) => tuning[time] ?? 0);
  return values.join(",") as AladhanTuningString;
};

const METHOD_IDS = PRAYER_TIME_PROVIDERS.ALADHAN.methods.map(({ id }) => id);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const oneOf = <T>(known: readonly T[], value: unknown): T | undefined =>
  known.find((candidate) => candidate === value);

// A timing the provider leaves out was not moved.
const minutes = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const parseTune = (raw: unknown): AladhanTuning | undefined =>
  isRecord(raw)
    ? {
        imsak: minutes(raw.imsak),
        fajr: minutes(raw.fajr),
        sunrise: minutes(raw.sunrise),
        dhuhr: minutes(raw.dhuhr),
        asr: minutes(raw.asr),
        maghrib: minutes(raw.maghrib),
        sunset: minutes(raw.sunset),
        isha: minutes(raw.isha),
        midnight: minutes(raw.midnight),
      }
    : undefined;

/**
 * The settings the provider reports it used, keeping only values the app knows.
 * Null when the response carries none.
 */
export const parseAladhanApplied = (raw: unknown): AladhanSettings | null => {
  if (!isRecord(raw)) return null;
  const settings: AladhanSettings = {};
  const method = oneOf(METHOD_IDS, raw.method);
  const madhab = oneOf(Object.values(ASR_SCHOOL), raw.madhab);
  const midnightMode = oneOf(Object.values(MIDNIGHT_MODE), raw.midnightMode);
  const tune = parseTune(raw.tune);
  if (method !== undefined) settings.method = method;
  if (madhab !== undefined) settings.madhab = madhab;
  if (midnightMode !== undefined) settings.midnightMode = midnightMode;
  if (tune) settings.tune = tune;
  return settings;
};
