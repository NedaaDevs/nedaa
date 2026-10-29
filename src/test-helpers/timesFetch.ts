import { TIMES_FETCH, type TimesFetch } from "@/constants/PrayerTimes";
import { useLocationStore } from "@/stores/location";
import type { PrayerTimesResponse } from "@/types/prayerTimes";

/**
 * A `getPrayerTimes` stand-in: the request lands, in the saved place's zone,
 * once `outcome` resolves STORED, and fails otherwise. The store writes it
 * through `PrayerTimesDB.insertPrayerTimes`, which the suite stubs.
 */
export const fetchLandingAs = (outcome: () => Promise<TimesFetch>) =>
  jest.fn(async (): Promise<PrayerTimesResponse> => {
    if ((await outcome()) !== TIMES_FETCH.STORED) throw new Error("offline");
    return {
      timezone: useLocationStore.getState().locationDetails.timezone,
      coordinates: { lat: 0, lng: 0 },
      provider: "aladhan",
      months: {},
    };
  });
