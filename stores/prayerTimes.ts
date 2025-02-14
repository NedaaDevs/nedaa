import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { compareAsc, parseISO } from "date-fns";

// Types
import { PrayerName, PrayerTimesResponse, PrayerTimesStore } from "@/types/prayerTimes";
import { ErrorResponse } from "@/types/api";

// Api
import { prayerTimesApi } from "@/api/prayerTimes.api";

// Services
import { PrayerTimesDB } from "@/services/db";

// Stores
import locationStore from "@/stores/location";

// Utils
import { getThreeDayDateRange, timeZonedNow } from "@/utils/date";

export const usePrayerTimesStore = create<PrayerTimesStore>()(
  devtools(
    persist(
      (set, get) => ({
        isLoading: false,
        yesterdayTimings: null,
        todayTimings: null,
        tomorrowTimings: null,

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

        loadPrayerTimes: async (forceGetAndStore = false): Promise<void> => {
          try {
            set({ isLoading: true });

            // Get location details from location store
            const { locationDetails } = locationStore.getState();

            // Calculate yesterday, today, and tomorrow based on the location timezone
            const { yesterday, today, tomorrow } = getThreeDayDateRange(locationDetails.timezone);

            // Try to get stored prayer times
            const [yesterdayTimings, todayTimings, tomorrowTimings] = await Promise.all([
              PrayerTimesDB.getPrayerTimesByDate(yesterday),
              PrayerTimesDB.getPrayerTimesByDate(today),
              PrayerTimesDB.getPrayerTimesByDate(tomorrow),
            ]);

            // If we don't have complete data for all three days or forceGetAndStore is true, fetch and store new data
            if (forceGetAndStore || !yesterdayTimings || !todayTimings || !tomorrowTimings) {
              const success = await get().getAndStorePrayerTimes({
                lat: locationDetails.coords.latitude,
                long: locationDetails.coords.longitude,
              });

              if (!success) {
                throw new Error("Failed to fetch and store prayer times");
              }

              // After storing, get the updated prayer times
              const [newYesterday, newToday, newTomorrow] = await Promise.all([
                PrayerTimesDB.getPrayerTimesByDate(yesterday),
                PrayerTimesDB.getPrayerTimesByDate(today),
                PrayerTimesDB.getPrayerTimesByDate(tomorrow),
              ]);

              set({
                yesterdayTimings: newYesterday,
                todayTimings: newToday,
                tomorrowTimings: newTomorrow,
              });
            } else {
              // If we have all the data, just update the store
              set({
                yesterdayTimings,
                todayTimings,
                tomorrowTimings,
              });
            }

            // TODO: Clean up old data (delete data older than 2 days)
            // await get().cleanupOldData();
          } catch (error: any) {
            console.error("Failed to load prayer times:", error);
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },
        getNextPrayer: () => {
          // TODO: Recheck this and previous prayer and the way we sort, prase and compare dates if we can avoid any unnecessary steps
          const state = get();
          const timezone = locationStore.getState().locationDetails.timezone;
          const now = timeZonedNow(timezone);

          if (!state.todayTimings) return null;

          // Check today's prayers first
          const todayPrayers = Object.entries(state.todayTimings.timings)
            .map(([name, time]) => ({
              name: name as PrayerName,
              time,
              date: state.todayTimings!.date,
            }))
            .sort((a, b) => compareAsc(parseISO(a.time), parseISO(b.time)));

          // Find the next prayer today
          const nextPrayer = todayPrayers.find(
            (prayer) => compareAsc(now, parseISO(prayer.time)) === -1
          );

          if (nextPrayer) return nextPrayer;

          // If no prayer found today and we have tomorrow's prayers,
          // return the first prayer of tomorrow
          if (state.tomorrowTimings) {
            const tomorrowPrayers = Object.entries(state.tomorrowTimings.timings)
              .map(([name, time]) => ({
                name: name as PrayerName,
                time,
                date: state.tomorrowTimings!.date,
              }))
              .sort((a, b) => compareAsc(parseISO(a.time), parseISO(b.time)));

            return tomorrowPrayers[0];
          }

          return null;
        },
        getPreviousPrayer: () => {
          const state = get();
          const timezone = locationStore.getState().locationDetails.timezone;
          const now = timeZonedNow(timezone);

          if (!state.todayTimings) return null;

          const todayPrayers = Object.entries(state.todayTimings.timings)
            .map(([name, time]) => ({
              name: name as PrayerName,
              time,
              date: state.todayTimings!.date,
            }))
            .sort((a, b) => compareAsc(parseISO(a.time), parseISO(b.time)));

          // Find the last prayer that has already passed
          const previousPrayer = [...todayPrayers]
            .reverse()
            .find((prayer) => compareAsc(parseISO(prayer.time), now) === -1);

          if (previousPrayer) return previousPrayer;

          // If no previous prayer found today (meaning we're before the first prayer of the day)
          // and we have yesterday's prayers, return the last prayer from yesterday(Isha)
          if (state.yesterdayTimings) {
            const yesterdayPrayers = Object.entries(state.yesterdayTimings.timings)
              .map(([name, time]) => ({
                name: name as PrayerName,
                time,
                date: state.yesterdayTimings!.date,
              }))
              .sort((a, b) => compareAsc(parseISO(a.time), parseISO(b.time)));

            return yesterdayPrayers[yesterdayPrayers.length - 1];
          }

          return null;
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
