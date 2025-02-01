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

// Stores
import locationStore from "@/stores/location";

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

            return response.data;
          } catch (error: any) {
            throw error;
          } finally {
            set({
              isLoading: false,
            });
          }
        },

        getAndStorePrayerTimes: async (params): Promise<boolean> => {
          try {
            const data = await get().getPrayerTimes(params);

            locationStore.getState().setTimezone(data.timezone);

            const insertionResult = await PrayerTimesDB.insertPrayerTimes(data);

            if (!insertionResult.success) {
              throw new Error("Failed to save prayer times", {
                cause: insertionResult.error,
              });
            }

            return true;
          } catch (error: any) {
            console.error("Failed getAndStorePrayerTimes: ", error);
            return false;
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
