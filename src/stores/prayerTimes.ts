import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { addDays, format, subDays } from "date-fns";

import i18n from "@/localization/i18n";

// Types
import {
  DayPrayerTimes,
  OtherTiming,
  OtherTimingName,
  Prayer,
  PrayerName,
  PrayerTimesResponse,
  Provider,
} from "@/types/prayerTimes";
import { ErrorResponse } from "@/types/api";

// Api
import { prayerTimesApi } from "@/api/prayerTimes.api";

// Services
import { PrayerTimesDB } from "@/services/db";

// Stores
import locationStore from "@/stores/location";
import providerSettingsStore from "@/stores/providerSettings";
import { useAppStore } from "@/stores/app";

// Utils
import { dateToInt, getTimezoneMonth, getTimezoneYear, timeZonedNow } from "@/utils/date";
import { earliest, firstAfter, lastBefore, latest } from "@/utils/prayerSelection";
import { checkLocationPermission } from "@/utils/location";
import { AppLogger } from "@/utils/appLogger";

// Adapters
import { getAdapterByProviderId } from "@/adapters/providers";

// Widget
import { reloadPrayerWidgets } from "../../modules/expo-widget/src";
import { refreshAllWidgets } from "../../modules/expo-widgets/src";

const log = AppLogger.create("prayertimes");

export type PrayerTimesStore = {
  didGetCurrentLocation: boolean;
  isLoading: boolean;
  isGettingProviders: boolean;
  hasError: boolean;
  errorMessage: string;
  selectedProvider: Provider | null;
  yesterdayTimings: DayPrayerTimes | null;
  todayTimings: DayPrayerTimes | null;
  tomorrowTimings: DayPrayerTimes | null;
  twoWeeksTimings: DayPrayerTimes[] | null;
  providers: Provider[];
  getPrayerTimes: (yearOverride?: number, month?: number) => Promise<PrayerTimesResponse>;
  getProviders: () => Promise<Provider[]>;
  getAndStorePrayerTimes: (yearOverride?: number, month?: number) => Promise<boolean>;
  loadPrayerTimes: (forceGetAndStore?: boolean) => Promise<void>;
  getNextPrayer: () => Prayer | null;
  getNextOtherTiming: () => OtherTiming | null;
  getPreviousPrayer: () => Prayer | null;
  cleanupOldData: (olderThanDays?: number) => Promise<boolean>;
  clearError: () => void;
};

// A day's stored timings as comparable prayer entries.
const toPrayers = (day: DayPrayerTimes): Prayer[] =>
  Object.entries(day.timings).map(([name, time]) => ({
    name: name as PrayerName,
    time,
    date: day.date,
  }));

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
        selectedProvider: null,
        didGetCurrentLocation: false,
        isLoading: false,
        isGettingProviders: false,
        hasError: false,
        errorMessage: "",
        yesterdayTimings: null,
        todayTimings: null,
        tomorrowTimings: null,
        twoWeeksTimings: null,
        providers: [],

        getPrayerTimes: async (
          yearOverride?: number,
          month?: number
        ): Promise<PrayerTimesResponse> => {
          try {
            set({ isLoading: true });

            const { currentProviderId } = providerSettingsStore.getState();

            const adapter = getAdapterByProviderId(currentProviderId);

            const apiParams = adapter.toParams(yearOverride, month);

            const response = await prayerTimesApi.get(apiParams);

            if (!response.success) {
              throw response as ErrorResponse;
            }

            return response.data;
          } catch (error: any) {
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },
        getProviders: async (): Promise<Provider[]> => {
          try {
            set({
              isGettingProviders: true,
            });
            const response = await prayerTimesApi.getProviders();

            if (!response.success) {
              throw response as ErrorResponse;
            }

            set({
              providers: response.data,
              selectedProvider: response.data[0], // TODO: when we have more than one provider we should decide default provider based on accuracy for country
            });

            return response.data;
          } catch (error: any) {
            throw error;
          } finally {
            set({
              isGettingProviders: false,
            });
          }
        },

        getAndStorePrayerTimes: async (yearOverride?: number, month?: number): Promise<boolean> => {
          try {
            const data = await get().getPrayerTimes(yearOverride, month);

            locationStore.getState().setTimezone(data.timezone);

            const insertionResult = await PrayerTimesDB.insertPrayerTimes(data);

            if (!insertionResult.success) {
              throw new Error("Failed to save prayer times", {
                cause: insertionResult.error,
              });
            }

            reloadPrayerWidgets();
            refreshAllWidgets();

            log.i("Fetch", `stored prayer times (${yearOverride ?? "current"}/${month ?? "all"})`);
            return true;
          } catch (error: any) {
            log.e(
              "Fetch",
              "getAndStorePrayerTimes failed",
              error instanceof Error ? error : undefined
            );
            return false;
          }
        },

        clearError: () => {
          set({ hasError: false, errorMessage: "" });
        },

        loadPrayerTimes: async (forceGetAndStore = false): Promise<void> => {
          try {
            // Clear any previous errors
            set({ hasError: false, errorMessage: "" });
            useAppStore.getState().setLoadingState(true, i18n.t("common.loadingPrayerTimes"));

            // If we haven't already got the current location, acquire it before reading prayer data.
            if (!get().didGetCurrentLocation && (await checkLocationPermission()).granted) {
              try {
                await locationStore.getState().initializeLocation();
              } catch (error) {
                if (!locationStore.getState().lastKnownCoords) {
                  throw error;
                }
                log.w(
                  "Load",
                  `current location failed; using verified saved coordinates: ${(error as Error)?.message ?? error}`
                );
              }
            }

            const { locationDetails, lastKnownCoords } = locationStore.getState();
            if (!lastKnownCoords) {
              set({ didGetCurrentLocation: false });
              throw new Error(locationDetails.error || i18n.t("location.permission.deniedMessage"));
            }

            set({ didGetCurrentLocation: true });
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
            if (forceGetAndStore || !yesterdayTimings || !todayTimings || !tomorrowTimings) {
              log.i(
                "Load",
                `refetching: ${
                  forceGetAndStore
                    ? "forced"
                    : `missing ${[
                        !yesterdayTimings && "yesterday",
                        !todayTimings && "today",
                        !tomorrowTimings && "tomorrow",
                      ]
                        .filter(Boolean)
                        .join("+")}`
                }`
              );
              const currentYear = getTimezoneYear(locationDetails.timezone);
              const currentMonth = getTimezoneMonth(locationDetails.timezone);

              // Fetch from the current month onward for the current year
              const success = await get().getAndStorePrayerTimes(undefined, currentMonth);

              if (!success) {
                throw new Error("Failed to fetch and store prayer times");
              }

              // Fetch adjacent year if at a year boundary
              if (currentMonth === 1) {
                await get().getAndStorePrayerTimes(currentYear - 1);
              } else if (currentMonth === 12) {
                await get().getAndStorePrayerTimes(currentYear + 1);
              }

              // Re-query DB for the updated data
              const newYesterdayTimings = await PrayerTimesDB.getPrayerTimesByDate(yesterday);
              const newTwoWeeksTimings = await PrayerTimesDB.getPrayerTimesByDateRange(
                startDate,
                endDate
              );
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
              set({
                yesterdayTimings,
                todayTimings,
                tomorrowTimings,
                twoWeeksTimings: twoWeeksTimings.length > 0 ? twoWeeksTimings : null,
              });
            }

            await get().cleanupOldData();
          } catch (error: any) {
            log.e("Load", "loadPrayerTimes failed", error instanceof Error ? error : undefined);
            set({
              hasError: true,
              errorMessage: error.message || "Failed to load prayer times",
            });
            throw error;
          } finally {
            useAppStore.getState().setLoadingState(false);
          }
        },
        getNextPrayer: () => {
          const state = get();
          // A real instant, not timeZonedNow(): the stored times already carry the
          // location's offset, so the comparison must not involve the device zone.
          const now = new Date();

          if (!state.todayTimings) return null;

          const nextToday = firstAfter(toPrayers(state.todayTimings), now);
          if (nextToday) return nextToday;

          // Every prayer today has passed, so the next one belongs to tomorrow.
          // Fall back to tomorrow's first prayer even if it too reads as past —
          // cached data can lag the clock, and returning null blanks the screen.
          if (state.tomorrowTimings) {
            const tomorrow = toPrayers(state.tomorrowTimings);
            return firstAfter(tomorrow, now) ?? earliest(tomorrow);
          }

          return null;
        },
        getPreviousPrayer: () => {
          const state = get();
          const now = new Date();

          if (!state.todayTimings) return null;

          const lastToday = lastBefore(toPrayers(state.todayTimings), now);
          if (lastToday) return lastToday;

          // Before the first prayer of the day, so the previous one is yesterday's
          // Isha. Same reasoning as above: take the last one even if the cached
          // day sits ahead of the clock.
          if (state.yesterdayTimings) {
            const yesterday = toPrayers(state.yesterdayTimings);
            return lastBefore(yesterday, now) ?? latest(yesterday);
          }

          return null;
        },
        getNextOtherTiming: () => {
          const state = get();
          if (!state.todayTimings?.otherTimings) return null;

          const now = new Date();
          const timings = Object.entries(state.todayTimings.otherTimings);

          // Convert all timings to Date objects with their names
          const timingsWithDates = timings.map(([name, time]) => ({
            name: name as OtherTimingName,
            time,
            date: new Date(time),
          }));

          // Sort by time
          timingsWithDates.sort((a, b) => a.date.getTime() - b.date.getTime());

          // Find the next timing after current time
          const nextTiming = timingsWithDates.find((timing) => timing.date > now);

          // If no timing is found for today, the first timing of tomorrow would be next
          return nextTiming
            ? {
                name: nextTiming.name,
                time: nextTiming.time,
                date: state.todayTimings.date,
              }
            : null;
        },
        cleanupOldData: async (olderThanDays = 2): Promise<boolean> => {
          try {
            const timezone = locationStore.getState().locationDetails.timezone;
            const now = timeZonedNow(timezone);
            const cutoffDate = dateToInt(subDays(now, olderThanDays));

            return await PrayerTimesDB.cleanData(cutoffDate);
          } catch (error) {
            log.w("DB", `cleanup of old rows failed: ${(error as Error)?.message ?? error}`);
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

export default usePrayerTimesStore;
