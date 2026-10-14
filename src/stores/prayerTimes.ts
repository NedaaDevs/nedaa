import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { addDays, format, subDays } from "date-fns";

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

// Utils
import { dateToInt, getTimezoneMonth, getTimezoneYear, timeZonedNow } from "@/utils/date";
import { earliest, firstAfter, lastBefore, latest } from "@/utils/prayerSelection";
import { checkLocationPermission } from "@/utils/location";
import { LocationMode } from "@/enums/location";
import { AppLogger } from "@/utils/appLogger";

// Adapters
import { getAdapterByProviderId } from "@/adapters/providers";

// Widget
import { reloadPrayerWidgets } from "expo-widget";

const log = AppLogger.create("prayertimes");

// Snapshot inputs include qada, whose notification actions depend on this store.
// Resolve the writer after initialization to keep that dependency out of startup.
const syncWidgetSnapshot = async (): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/services/widgetSnapshot") as typeof import("@/services/widgetSnapshot");
  await m.syncWidgetSnapshot();
};

export type PrayerTimesStore = {
  didGetCurrentLocation: boolean;
  /** The times on screen were computed from the default coordinates, not the user's. */
  usingDefaultLocation: boolean;
  isLoading: boolean;
  /** True while either load verb runs. */
  loadingTimes: boolean;
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
  /** Loads for the place the location store holds; takes no device fix. */
  loadPrayerTimesAtCurrentPlace: (forceGetAndStore?: boolean) => Promise<void>;
  /** Re-reads the two-week window from the database and resets the projections. */
  refreshTimingsFromDb: () => Promise<DayPrayerTimes[]>;
  // `now` is a parameter so callers that re-render on a clock tick recompute; without
  // it the result is memoized against inputs that never change.
  getNextPrayer: (now?: Date) => Prayer | null;
  getNextOtherTiming: (now?: Date) => OtherTiming | null;
  getPreviousPrayer: (now?: Date) => Prayer | null;
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

const toOtherTimings = (day: DayPrayerTimes): OtherTiming[] =>
  Object.entries(day.otherTimings).map(([name, time]) => ({
    name: name as OtherTimingName,
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

type SetTimes = (partial: Partial<PrayerTimesStore>) => void;
type GetTimes = () => PrayerTimesStore;

/** Takes the device fix until one lands: automatic mode, permission granted. */
const takeDeviceFixOnce = async (get: GetTimes): Promise<void> => {
  // A manual place is the user's: no device read, and no permission check.
  if (
    !get().didGetCurrentLocation &&
    locationStore.getState().locationMode === LocationMode.DEVICE &&
    (await checkLocationPermission()).granted
  ) {
    try {
      await locationStore.getState().initializeLocation();
    } catch (error) {
      log.w(
        "Load",
        `current location failed; falling back to saved or default coordinates: ${(error as Error)?.message ?? error}`
      );
    }
  }
};

/** The body of both load verbs; `takeFix` runs before the place is read. */
const loadTimes = async (
  set: SetTimes,
  get: GetTimes,
  forceGetAndStore: boolean,
  takeFix: () => Promise<void>
): Promise<void> => {
  try {
    // Clear any previous errors
    set({ hasError: false, errorMessage: "" });
    set({ loadingTimes: true });

    await takeFix();

    const { locationDetails, lastKnownCoords } = locationStore.getState();
    const verified = lastKnownCoords !== null;
    // No verified fix: Makkah stands in; loadPrayerTimes retries the fix later.
    if (!verified) {
      log.w("Load", "no verified coordinates; using the default location");
    }
    // Rows carry no place, so the default place's rows stand until refetched.
    const placeNewlyVerified = verified && get().usingDefaultLocation;

    set({
      didGetCurrentLocation: verified,
      // Surfaced in the UI: the times on screen are not for where the user is.
      usingDefaultLocation: !verified || placeNewlyVerified,
    });

    await get().refreshTimingsFromDb();
    const { yesterdayTimings, todayTimings, tomorrowTimings } = get();
    const missing = [
      !yesterdayTimings && "yesterday",
      !todayTimings && "today",
      !tomorrowTimings && "tomorrow",
    ].filter(Boolean);
    // The load fails without this fetch; a newly verified place is best effort.
    const required = forceGetAndStore || missing.length > 0;

    if (required || placeNewlyVerified) {
      log.i(
        "Load",
        `refetching: ${
          forceGetAndStore ? "forced" : required ? `missing ${missing.join("+")}` : "place verified"
        }`
      );
      const currentYear = getTimezoneYear(locationDetails.timezone);
      const currentMonth = getTimezoneMonth(locationDetails.timezone);

      // Fetch from the current month onward for the current year
      const success = await get().getAndStorePrayerTimes(undefined, currentMonth);

      if (success) {
        // Fetch adjacent year if at a year boundary
        if (currentMonth === 1) {
          await get().getAndStorePrayerTimes(currentYear - 1);
        } else if (currentMonth === 12) {
          await get().getAndStorePrayerTimes(currentYear + 1);
        }

        await get().refreshTimingsFromDb();
        // After the refresh, so the old rows never read as verified.
        set({ usingDefaultLocation: !verified });
      } else if (required) {
        throw new Error("Failed to fetch and store prayer times");
      } else {
        // The default place's rows and flag stand; the next load retries.
        log.w("Load", "place-verified refetch failed; the default place's times stay");
      }
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
    // Cached and offline launches still publish their stored days to widgets.
    await syncWidgetSnapshot();
    set({ loadingTimes: false });
  }
};

export const usePrayerTimesStore = create<PrayerTimesStore>()(
  devtools(
    persist(
      (set, get) => ({
        selectedProvider: null,
        didGetCurrentLocation: false,
        usingDefaultLocation: false,
        isLoading: false,
        loadingTimes: false,
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

            // Only the current year's fetch holds today, so only it reports on today.
            if (yearOverride === undefined) {
              const { currentProviderId, setInEffect } = providerSettingsStore.getState();
              setInEffect(getAdapterByProviderId(currentProviderId).fromApplied(data.applied));
            }

            reloadPrayerWidgets();
            await syncWidgetSnapshot();

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

        // The projections persist between launches, so without this recompute a
        // reader gets the window of the last launch — it ends 13 days after
        // that launch, and the schedulable horizon shrinks daily.
        refreshTimingsFromDb: async (): Promise<DayPrayerTimes[]> => {
          const { locationDetails } = locationStore.getState();
          const now = timeZonedNow(locationDetails.timezone);
          const yesterday = dateToInt(subDays(now, 1));
          const today = dateToInt(now);
          const tomorrow = dateToInt(addDays(now, 1));
          const { startDate, endDate } = getTwoWeeksDateRange(locationDetails.timezone);

          const twoWeeksTimings = await PrayerTimesDB.getPrayerTimesByDateRange(startDate, endDate);
          const yesterdayTimings = await PrayerTimesDB.getPrayerTimesByDate(yesterday);

          set({
            yesterdayTimings,
            todayTimings: twoWeeksTimings.find((timing) => timing.date === today) ?? null,
            tomorrowTimings: twoWeeksTimings.find((timing) => timing.date === tomorrow) ?? null,
            twoWeeksTimings: twoWeeksTimings.length > 0 ? twoWeeksTimings : null,
          });

          return twoWeeksTimings;
        },

        loadPrayerTimes: (forceGetAndStore = false) =>
          loadTimes(set, get, forceGetAndStore, () => takeDeviceFixOnce(get)),
        loadPrayerTimesAtCurrentPlace: (forceGetAndStore = false) =>
          loadTimes(set, get, forceGetAndStore, async () => {}),
        getNextPrayer: (now = new Date()) => {
          const state = get();
          // Real instant: stored times already carry the location's offset.

          if (!state.todayTimings) return null;

          const nextToday = firstAfter(toPrayers(state.todayTimings), now);
          if (nextToday) return nextToday;

          // Tomorrow's first, even if it reads as past: null would blank the screen.
          if (state.tomorrowTimings) {
            const tomorrow = toPrayers(state.tomorrowTimings);
            return firstAfter(tomorrow, now) ?? earliest(tomorrow);
          }

          return null;
        },
        getPreviousPrayer: (now = new Date()) => {
          const state = get();

          if (!state.todayTimings) return null;

          const lastToday = lastBefore(toPrayers(state.todayTimings), now);
          if (lastToday) return lastToday;

          // Before the day's first prayer, so the previous one is yesterday's Isha.
          if (state.yesterdayTimings) {
            const yesterday = toPrayers(state.yesterdayTimings);
            return lastBefore(yesterday, now) ?? latest(yesterday);
          }

          return null;
        },
        getNextOtherTiming: (now = new Date()) => {
          const state = get();
          if (!state.todayTimings?.otherTimings) return null;

          const today = toOtherTimings(state.todayTimings);

          const nextToday = firstAfter(today, now);
          if (nextToday) return nextToday;

          // Tomorrow's first; same never-null rule as the prayers.
          if (state.tomorrowTimings?.otherTimings) {
            const tomorrow = toOtherTimings(state.tomorrowTimings);
            return firstAfter(tomorrow, now) ?? earliest(tomorrow);
          }

          // No upcoming timing rather than one already past, which would render a
          // zero countdown beside an elapsed timestamp.
          return null;
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

/** Whether today's times are on their way: a load or a fetch is running. */
export const selectTimesLoading = (state: PrayerTimesStore) =>
  state.isLoading || state.loadingTimes;

/** The stored times are for a verified place, not the default one. */
export const selectVerifiedPlace = (state: PrayerTimesStore) => !state.usingDefaultLocation;

/** Today's times are stored for a verified place, not the default one. */
export const selectTodayStored = (state: PrayerTimesStore) =>
  state.todayTimings !== null && selectVerifiedPlace(state);

export default usePrayerTimesStore;
