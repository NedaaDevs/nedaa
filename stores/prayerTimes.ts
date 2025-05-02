import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { addDays, compareAsc, format, parseISO, subDays } from "date-fns";

// Types
import {
  DayPrayerTimes,
  Prayer,
  PrayerName,
  PrayerTimesParams,
  PrayerTimesResponse,
} from "@/types/prayerTimes";
import { ErrorResponse } from "@/types/api";

// Api
import { prayerTimesApi } from "@/api/prayerTimes.api";

// Services
import { PrayerTimesDB } from "@/services/db";

// Stores
import locationStore from "@/stores/location";

// Utils
import { dateToInt, timeZonedNow } from "@/utils/date";

export type PrayerTimesStore = {
  isLoading: boolean;
  yesterdayTimings: DayPrayerTimes | null;
  todayTimings: DayPrayerTimes | null;
  tomorrowTimings: DayPrayerTimes | null;
  twoWeeksTimings: DayPrayerTimes[] | null;
  getPrayerTimes: (params: PrayerTimesParams) => Promise<PrayerTimesResponse>;
  getAndStorePrayerTimes: (params: PrayerTimesParams) => Promise<boolean>;
  loadPrayerTimes: (forceGetAndStore?: boolean) => Promise<void>;
  getNextPrayer: () => Prayer | null;
  getPreviousPrayer: () => Prayer | null;
  cleanupOldData: (olderThanDays?: number) => Promise<boolean>;
};

const getTwoWeeksDateRange = (timezone: string) => {
  const now = timeZonedNow(timezone);

  // Today as integer (YYYYMMDD)
  const today = parseInt(format(now, "yyyyMMdd"));

  // End date (today + 13 days)
  const endDate = parseInt(format(addDays(now, 13), "yyyyMMdd"));

  return { startDate: today, endDate };
};

export const usePrayerTimesStore = create<PrayerTimesStore>()(
  devtools(
    persist(
      (set, get) => ({
        isLoading: false,
        yesterdayTimings: null,
        todayTimings: null,
        tomorrowTimings: null,
        twoWeeksTimings: null,

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
            // Get yesterday, today, tomorrow dates
            const now = timeZonedNow(locationDetails.timezone);
            const yesterday = dateToInt(subDays(now, 1));
            const today = dateToInt(now);
            const tomorrow = dateToInt(addDays(now, 1));

            // Calculate two week date range (today to today+13 days)
            const { startDate, endDate } = getTwoWeeksDateRange(locationDetails.timezone);

            // Fetch the two weeks data
            const twoWeeksTimings = await PrayerTimesDB.getPrayerTimesByDateRange(
              startDate,
              endDate
            );

            // Get yesterday's data separately since it's not in the two weeks range
            const yesterdayTimings = await PrayerTimesDB.getPrayerTimesByDate(yesterday);

            // Find today and tomorrow in the returned array by date
            const todayTimings = twoWeeksTimings.find((timing) => timing.date === today) ?? null;
            const tomorrowTimings =
              twoWeeksTimings.find((timing) => timing.date === tomorrow) ?? null;

            // Check if we need to fetch fresh data
            // Either we're forcing a refresh, missing data.
            if (forceGetAndStore || !yesterdayTimings || !todayTimings || !tomorrowTimings) {
              const success = await get().getAndStorePrayerTimes({
                lat: locationDetails.coords.latitude,
                long: locationDetails.coords.longitude,
              });

              if (!success) {
                throw new Error("Failed to fetch and store prayer times");
              }

              // After storing, get the updated prayer times
              // First get yesterday
              const newYesterdayTimings = await PrayerTimesDB.getPrayerTimesByDate(yesterday);

              // Then get the two weeks data again
              const newTwoWeeksTimings = await PrayerTimesDB.getPrayerTimesByDateRange(
                startDate,
                endDate
              );

              // Find today and tomorrow in the new data by date
              const newTodayTimings =
                newTwoWeeksTimings.find((timing) => timing.date === today) ?? null;
              const newTomorrowTimings =
                newTwoWeeksTimings.find((timing) => timing.date === tomorrow) ?? null;

              set({
                yesterdayTimings: newYesterdayTimings,
                todayTimings: newTodayTimings,
                tomorrowTimings: newTomorrowTimings,
                twoWeeksTimings: newTwoWeeksTimings.length > 0 ? newTwoWeeksTimings : null,
              });
            } else {
              // If we have all the data, just update the store
              set({
                yesterdayTimings,
                todayTimings,
                tomorrowTimings,
                twoWeeksTimings: twoWeeksTimings.length > 0 ? twoWeeksTimings : null,
              });
            }

            await get().cleanupOldData();
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
        cleanupOldData: async (olderThanDays = 2): Promise<boolean> => {
          try {
            const timezone = locationStore.getState().locationDetails.timezone;
            const now = timeZonedNow(timezone);
            const cutoffDate = dateToInt(subDays(now, olderThanDays));

            return await PrayerTimesDB.cleanData(cutoffDate);
          } catch (error) {
            console.error("Failed to clean up old prayer times data:", error);
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
