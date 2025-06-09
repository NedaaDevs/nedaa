// Stores
import useProviderSettingsStore from "@/stores/providerSettings";
import useLocationStore from "@/stores/location";

// Types
import type {
  AladhanSettings,
  AladhanPrayerTimeName,
  AladhanTuning,
  AladhanTuningString,
  AladhanApiParams,
} from "@/types/providers/aladhan";

import { getTimezoneYear, getTimezoneMonth } from "@/utils/date";

/**
 * Return an api ready params
 */
export const transformAladhanParams = (): AladhanApiParams => {
  const location = useLocationStore.getState().locationDetails;
  const settings = useProviderSettingsStore.getState().getCurrentSettings<AladhanSettings>();

  // Get current date
  const year = getTimezoneYear(location.timezone);
  const month = getTimezoneMonth(location.timezone);

  // Build params
  const params: AladhanApiParams = {
    lat: location.coords.latitude,
    long: location.coords.longitude,
    year,
    month,
  };

  // Add other settings if they exist
  if (settings?.method !== undefined) {
    params.method = settings.method;
  }

  if (settings?.madhab !== undefined) {
    params.school = settings.madhab;
  }

  if (settings?.midnightMode !== undefined) {
    params.midnightMode = settings.midnightMode;
  }

  if (settings?.tune) {
    params.tune = tuningToString(settings.tune);
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
