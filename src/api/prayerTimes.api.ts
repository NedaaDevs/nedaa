import { apiGet } from "@/services/api";

// Constants
import { PRAYER_TIMES } from "@/constants/ApiRoutes";

// Types
import type { PrayerTimesResponse, Provider } from "@/types/prayerTimes";
import type { AladhanApiParams } from "@/types/providers/aladhan";

export const prayerTimesApi = {
  get: (params: AladhanApiParams) =>
    apiGet<PrayerTimesResponse>(PRAYER_TIMES.GET_PRAYER_TIMES, params),

  getProviders: () => apiGet<Provider[]>(PRAYER_TIMES.PROVIDERS),
};
