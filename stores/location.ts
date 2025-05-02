import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import * as Location from "expo-location";

// Types
import { LocationDetails, initialLocationDetails } from "@/types/location";

export type LocationStore = {
  locationDetails: LocationDetails;
  isGettingLocation: boolean;
  setLocation: () => Promise<void>;
  setTimezone: (timezone: string) => Promise<void>;
};

export const useLocationStore = create<LocationStore>()(
  devtools(
    persist(
      (set, get) => ({
        locationDetails: initialLocationDetails,
        isGettingLocation: false,

        setLocation: async () => {
          try {
            // TODO: Use locale to get localized city name, and subscribe to locale state
            // to update geocoding results
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });

            const [geocodedAddress] = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });

            const timezone = get().locationDetails.timezone;
            set({
              locationDetails: {
                coords: location.coords,
                address: geocodedAddress,
                error: null,
                isLoading: false,
                timezone,
              },
            });
          } catch (error) {
            console.error("Error getting location:", error);
            set((state) => ({
              locationDetails: {
                ...state.locationDetails,
                error: error instanceof Error ? error.message : "Failed to get location",
                isLoading: false,
              },
            }));
          } finally {
            set((state) => ({
              ...state,
              isGettingLocation: false,
            }));
          }
        },

        setTimezone: async (timezone: string) => {
          const locationDetails = get().locationDetails;
          set({
            locationDetails: {
              ...locationDetails,
              timezone,
            },
          });
        },
      }),
      {
        name: "location-storage",
        storage: createJSONStorage(() => Storage),
      }
    ),
    { name: "LocationStore" }
  )
);

export default useLocationStore;
// TODO: listen for locale changes to update reverse geocoding data
// useAppStore.subscribe(
//   (state) => state.locale,
//   (newLocale) => {
//     console.log("🚀 => newLocale:", newLocale);
//   }
// );
