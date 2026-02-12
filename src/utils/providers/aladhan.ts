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
export const transformAladhanParams = (yearOverride?: number): AladhanApiParams => {
  const location = useLocationStore.getState().locationDetails;
  const settings = useProviderSettingsStore.getState().getCurrentSettings<AladhanSettings>();

  const year = yearOverride ?? getTimezoneYear(location.timezone);

  const params: AladhanApiParams = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    year,
  };

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
