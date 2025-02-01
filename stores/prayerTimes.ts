import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

// Types
import { PrayerTimesResponse, PrayerTimesStore } from "@/types/prayerTimes";
import { ErrorResponse } from "@/types/api";

// Api
import { prayerTimesApi } from "@/api/prayerTimes.api";

// Services
import { PrayerTimesDB } from "@/services/db";

export const usePrayerTimesStore = create<PrayerTimesStore>()(
  devtools(
    persist(
      (set, get) => ({
        isLoading: false,

        getPrayerTimes: async (params): Promise<PrayerTimesResponse> => {
          try {
            set({
              isLoading: true,
            });
            const response = await prayerTimesApi.get(params);

            if (!response.success) {
              throw response as ErrorResponse;
            }

            const insertionResult = await PrayerTimesDB.insertPrayerTimes(response.data);

            if (!insertionResult.success) {
              throw new Error("Failed to save prayer times", {
                cause: insertionResult.error,
              });
            }

            return response.data;
          } catch (error: any) {
            throw error;
          } finally {
            set({
              isLoading: false,
            });
          }
        },
      }),
      {
        name: "prayerTimes-storage",
        storage: createJSONStorage(() => Storage),
      }
    ),
    { name: "PrayerTimesStores" }
  )
);
