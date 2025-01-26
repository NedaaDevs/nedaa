import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

// Types
import { PrayerTimesResponse, PrayerTimesStore } from "@/types/prayerTimes";
import { ErrorResponse } from "@/types/api";

// Api
import { prayerTimesApi } from "@/api/prayerTimes.api";

export const usePrayerTimesStore = create<PrayerTimesStore>()(
  devtools(
    persist(
      () => ({
        getPrayerTimes: async (params): Promise<PrayerTimesResponse> => {
          try {
            const data = await prayerTimesApi.get(params);

            if (!data.success) {
              throw data as ErrorResponse;
            }

            return data.data;
          } catch (error: any) {
            throw error;
          }
        },
      }),
      {
        name: "prayerTimes-storage",
        storage: createJSONStorage(() => AsyncStorage),
      },
    ),
    { name: "PrayerTimesStores" },
  ),
);
