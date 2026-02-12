import { apiGet } from "@/services/api";

// Constants
import { PRAYER_TIMES } from "@/constants/ApiRoutes";

// Types
import type { PrayerTimesResponse, Provider } from "@/types/prayerTimes";
import type { AladhanApiParams } from "@/types/providers/aladhan";

const flattenParams = (params: AladhanApiParams): Record<string, any> => {
  const { options, ...rest } = params;
  if (!options) return rest;

  const flat: Record<string, any> = { ...rest };
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      flat[key] = value;
    }
  }
  return flat;
};

export const prayerTimesApi = {
  get: (params: AladhanApiParams) =>
    apiGet<PrayerTimesResponse>(PRAYER_TIMES.GET_PRAYER_TIMES, flattenParams(params)),

  getProviders: () => apiGet<Provider[]>(PRAYER_TIMES.PROVIDERS),
};
