// Stores
import useProviderSettingsStore from "@/stores/providerSettings";
import useLocationStore from "@/stores/location";

// Types
import type {
  AladhanSettings,
  // AladhanMethodId,
  AladhanPrayerTimeName,
  AladhanTuning,
  AladhanTuningString,
  AladhanApiParams,
} from "@/types/providers/aladhan";

/**
 * Return an api ready params
 */
export const transformAladhanParams = (): AladhanApiParams => {
  const location = useLocationStore.getState().locationDetails;
  const settings = useProviderSettingsStore.getState().getCurrentSettings<AladhanSettings>();

  // Get current date
  const now = new Date();

  // Build params
  const params: AladhanApiParams = {
    lat: location.coords.latitude,
    long: location.coords.longitude,
    year: now.getFullYear(),
    month: now.getMonth() + 1, // JS months are 0-based, API expects 1-based
    // method: settings?.method || PRAYER_TIME_PROVIDERS.ALADHAN.defaults.method || 3,
  };

  // TODO: Other settings
  // if (settings?.madhab !== undefined) {
  //   params.school = settings.madhab;
  // }
  // if (settings?.tune) {
  //   params.tune = tuningToString(settings.tune);
  // }

  return params;
};

// Keep existing helper functions for later use
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

export const stringToTuning = (tuningString: AladhanTuningString): AladhanTuning => {
  const values = tuningString.split(",").map(Number);
  return PRAYER_TIME_ORDER.reduce((obj, time, index) => {
    const value = values[index];
    if (value !== 0) {
      obj[time] = value;
    }
    return obj;
  }, {} as AladhanTuning);
};
