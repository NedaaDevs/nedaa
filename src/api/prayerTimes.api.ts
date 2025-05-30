import { apiGet } from "@/services/api";

// Constants
import { PRAYER_TIMES } from "@/constants/ApiRoutes";

// Types
import type { PrayerTimesResponse, PrayerTimesParams, Provider } from "@/types/prayerTimes";

export const prayerTimesApi = {
  get: (params: PrayerTimesParams) =>
    apiGet<PrayerTimesResponse>(PRAYER_TIMES.GET_PRAYER_TIMES, params),

  getProviders: () => apiGet<Provider[]>(PRAYER_TIMES.PROVIDERS),
};
