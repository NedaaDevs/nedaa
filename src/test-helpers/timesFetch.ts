import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { useLocationStore } from "@/stores/location";
import type { PrayerTimesResponse } from "@/types/prayerTimes";

/** A `getPrayerTimes` stand-in: it answers in the saved place's zone once
 * `lands` resolves true, and rejects when it resolves false. */
export const fetchLandingAs = (lands: () => Promise<boolean>) =>
  jest.fn(async (): Promise<PrayerTimesResponse> => {
    if (!(await lands())) throw new Error("offline");
    return {
      timezone: useLocationStore.getState().locationDetails.timezone,
      coordinates: { lat: 0, lng: 0 },
      provider: PRAYER_TIME_PROVIDERS.ALADHAN.id,
      months: {},
    };
  });
