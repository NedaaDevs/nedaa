import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import * as Location from "expo-location";

// Types
import { LocationDetails, initialLocationDetails } from "@/types/location";

// Stores
import appStore from "@/stores/app";

// Services
import { geocodeApi } from "@/api/geocodeApi";
import { ReverseGeocodeParams, ReverseGeocodeResponse } from "@/types/geocode";
import { ErrorResponse } from "@/types/api";

export type LocationStore = {
  locationDetails: LocationDetails;
  isGettingLocation: boolean;
  updateLocation: () => Promise<void>;
  reverseGeocode: (params: ReverseGeocodeParams) => Promise<ReverseGeocodeResponse>;
  setTimezone: (timezone: string) => Promise<void>;
};

export const useLocationStore = create<LocationStore>()(
  devtools(
    persist(
      (set, get) => ({
        locationDetails: initialLocationDetails,
        isGettingLocation: false,

        updateLocation: async () => {
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });

            try {
              // Now we have the coordinates we can reverse geocode to get city name.
              // preferably if we get a localized version to match the current app locale
              const geocodeAdd = await get().reverseGeocode({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                locale: appStore.getState().locale,
              });
              set({
                locationDetails: {
                  coords: location.coords,
                  address: {
                    country: geocodeAdd.countryName,
                    city: geocodeAdd.city,
                  },
                  error: null,
                  isLoading: false,
                  timezone: geocodeAdd.timezone,
                },
              });
              return;
            } catch {
              // if api reverse geocode failed(general error, rate limit etc) silently ignore error and continue
            }

            const [geocodedAddress] = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });

            const timezone = get().locationDetails.timezone;
            set({
              locationDetails: {
                coords: location.coords,
                address: {
                  country: geocodedAddress.country ?? "N/A",
                  city: geocodedAddress.city ?? "N/A",
                },
                error: null,
                isLoading: false,
                timezone,
              },
            });
          } catch (error) {
            console.error("Error getting location:", error);
            set({
              locationDetails: {
                ...get().locationDetails,
                error: error instanceof Error ? error.message : "Failed to get location",
                isLoading: false,
              },
            });
          } finally {
            set({
              isGettingLocation: false,
            });
          }
        },

        reverseGeocode: async (params) => {
          try {
            const response = await geocodeApi.reverseGeocode({
              latitude: params.latitude,
              longitude: params.longitude,
              locale: params.locale,
            });

            if (!response.success) {
              throw response as ErrorResponse;
            }

            return response.data;
          } catch (error: any) {
            console.error("Failed reverse geocode: ", error);
            throw error as ErrorResponse;
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
