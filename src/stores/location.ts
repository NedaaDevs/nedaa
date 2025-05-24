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

// Constants
const CITY_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CITY_CHANGE_THRESHOLD = 10; // km - minimum distance to consider city change

// Calculate distance between coordinates
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export type LocationStore = {
  locationDetails: LocationDetails;
  localizedLocation: {
    country: string;
    city: string;
  };
  isGettingLocation: boolean;
  lastCheckTimestamp: number | null;
  previousCity: string | null;
  keepLocationUpdated: boolean;
  hasLocationChanged: boolean;

  updateLocation: () => Promise<void>;
  updateAddressTranslation: () => Promise<boolean>;
  reverseGeocode: (params: ReverseGeocodeParams) => Promise<ReverseGeocodeResponse>;
  setTimezone: (timezone: string) => Promise<void>;
  setKeepLocationUpdated: (keepUpdated: boolean) => void;
  checkLocationIfNeeded: () => Promise<boolean>;
  forceLocationUpdate: () => Promise<void>;
  dismissLocationChangeNotification: () => void;
};

export const useLocationStore = create<LocationStore>()(
  devtools(
    persist(
      (set, get) => ({
        locationDetails: initialLocationDetails,
        localizedLocation: { country: "", city: "" },
        isGettingLocation: false,
        lastCheckTimestamp: null,
        previousCity: null,
        keepLocationUpdated: false,
        hasLocationChanged: false,

        setKeepLocationUpdated: async (keepLocationUpdated) => {
          set({
            keepLocationUpdated,
          });
        },
        // Check location only if 24 hours passed since last check
        checkLocationIfNeeded: async () => {
          const now = Date.now();
          const lastCheck = get().lastCheckTimestamp;

          // Skip if checked within last 24 hours
          if (lastCheck && now - lastCheck < CITY_CHECK_INTERVAL) {
            //TODO: remove log
            console.log("[LocationStore] Skipping check - checked recently");
            return false;
          }

          console.log("[LocationStore] Performing scheduled location check");
          await get().updateLocation();
          return true;
        },

        // Force update regardless of last check time
        forceLocationUpdate: async () => {
          await get().updateLocation();
        },

        dismissLocationChangeNotification: () => {
          set({ hasLocationChanged: false });
        },

        updateLocation: async () => {
          set({ isGettingLocation: true });

          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });

            const currentCoords = location.coords;
            const previousLocation = get().locationDetails;
            const previousCity = get().previousCity;

            // Check if location changed significantly
            let cityChanged = false;
            if (previousLocation.coords.latitude !== 0 && previousLocation.coords.longitude !== 0) {
              const distance = calculateDistance(
                previousLocation.coords.latitude,
                previousLocation.coords.longitude,
                currentCoords.latitude,
                currentCoords.longitude
              );

              cityChanged = distance > CITY_CHANGE_THRESHOLD;
              //TODO: remove log
              console.log(`[LocationStore] Distance from last location: ${distance.toFixed(2)}km`);
            }

            // Always get both geocoding results
            // 1. Get localized address for localizedLocation
            await get()
              .updateAddressTranslation()
              .catch((e) => {
                console.error(e);
              });

            // Get Expo's reverse geocoding for city change detection
            const [geocodedAddress] = await Location.reverseGeocodeAsync({
              latitude: currentCoords.latitude,
              longitude: currentCoords.longitude,
            });

            const timezone = get().locationDetails.timezone;
            const newCity = geocodedAddress.city ?? "N/A"; // This is the new city from Expo

            // Check if city name changed using Expo's geocoding result
            if (previousCity && previousCity !== newCity) {
              cityChanged = true;
            }
            // Update location details
            set({
              locationDetails: {
                coords: currentCoords,
                address: {
                  country: geocodedAddress.country ?? "N/A",
                  city: newCity,
                },
                error: null,
                isLoading: false,
                timezone,
              },
              previousCity: previousCity || newCity,
              hasLocationChanged: cityChanged && !!previousCity,
              lastCheckTimestamp: Date.now(),
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

        // Updated only to get localizedLocation (For display only)
        updateAddressTranslation: async () => {
          const location = get().locationDetails;

          const geocodeAdd = await get()
            .reverseGeocode({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              locale: appStore.getState().locale,
            })
            .catch((e) => console.error(e));

          if (geocodeAdd) {
            // Update localizedLocation with localized strings
            set({
              localizedLocation: {
                country: geocodeAdd.countryName,
                city: geocodeAdd.city,
              },
              locationDetails: {
                ...get().locationDetails,
                timezone: geocodeAdd.timezone,
              },
            });
            return true;
          }

          return false;
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
        partialize: (state) => ({
          locationDetails: state.locationDetails,
          localizedLocation: state.localizedLocation,
          lastCheckTimestamp: state.lastCheckTimestamp,
          previousCity: state.previousCity,
        }),
      }
    ),
    { name: "LocationStore" }
  )
);

export default useLocationStore;
