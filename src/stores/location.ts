import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import * as Location from "expo-location";

// Types
import { LocationDetails, initialLocationDetails } from "@/types/location";
import { ReverseGeocodeParams, ReverseGeocodeResponse } from "@/types/geocode";
import { ErrorResponse } from "@/types/api";

// Stores
import appStore from "@/stores/app";

// Services
import { geocodeApi } from "@/api/geocodeApi";

// Utils
import { getLocationWithTimeout, calculateDistance, CITY_CHANGE_THRESHOLD } from "@/utils/location";

export type LocationStore = {
  locationDetails: LocationDetails;
  localizedLocation: {
    country: string;
    city: string;
  };
  timezone: string;
  isLocationPermissionGranted: boolean;
  isGettingLocation: boolean;
  lastKnownCoords: {
    latitude: number;
    longitude: number;
  } | null;
  cityChangeDetected: boolean;
  autoUpdateLocation: boolean;
  showCityChangeModal: boolean;
  pendingCityChange: {
    currentCity: string;
    newCity: string;
  } | null;
  isUpdatingLocation: boolean;
  lastCityChangeCheck: string | null;

  initializeLocation: () => Promise<void>;
  setAutoUpdateLocation: (value: boolean) => void;
  updateCurrentLocation: () => Promise<void>;
  checkCityChange: () => Promise<boolean>;
  reverseGeocode: (params: ReverseGeocodeParams) => Promise<ReverseGeocodeResponse>;
  updateAddressTranslation: () => Promise<boolean>;
  setTimezone: (tz: string) => Promise<void>;
  checkAndPromptCityChange: () => Promise<void>;
  handleCityChangeUpdate: () => Promise<boolean>;
  dismissCityChangeModal: () => void;
};

export const useLocationStore = create<LocationStore>()(
  devtools(
    persist(
      (set, get) => ({
        locationDetails: initialLocationDetails,
        localizedLocation: { country: "", city: "" },
        timezone: "Asia/Riyadh",
        isLocationPermissionGranted: false,
        isGettingLocation: false,
        lastKnownCoords: null,
        cityChangeDetected: false,
        autoUpdateLocation: true,
        showCityChangeModal: false,
        pendingCityChange: null,
        isUpdatingLocation: false,
        lastCityChangeCheck: null,

        // Initialize location when permission is granted
        initializeLocation: async () => {
          set({ isGettingLocation: true });
          try {
            // Get initial location with timeout protection
            const location = await getLocationWithTimeout();
            console.log("Initial location retrieved", location.coords);

            const [geocodedAddress] = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });

            // Get localized version
            const localizedGeocode = await get()
              .reverseGeocode({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                locale: appStore.getState().locale,
              })
              .catch((error) => {
                console.error("Failed to get localized address:", error);
                return null;
              });

            // Set initial state
            set({
              locationDetails: {
                coords: location.coords,
                address: {
                  country: geocodedAddress.country ?? "N/A",
                  city: geocodedAddress.city ?? "N/A",
                },
                timezone: localizedGeocode?.timezone || "Asia/Riyadh",
                error: null,
                isLoading: false,
              },
              localizedLocation: {
                country: localizedGeocode?.countryName || geocodedAddress.country || "N/A",
                city: localizedGeocode?.city || geocodedAddress.city || "N/A",
              },
              lastKnownCoords: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              },
              isLocationPermissionGranted: true,
            });
          } catch (error) {
            console.error("Failed to initialize location:", error);
            set({
              locationDetails: {
                ...initialLocationDetails,
                error: error instanceof Error ? error.message : "Failed to initialize location",
                isLoading: false,
              },
            });
          } finally {
            set({ isGettingLocation: false });
          }
        },

        updateCurrentLocation: async () => {
          set({ isGettingLocation: true });
          try {
            const location = await getLocationWithTimeout();
            console.log(
              `Location updated to: ${location.coords.latitude}, ${location.coords.longitude}`
            );

            set((state) => ({
              locationDetails: {
                ...state.locationDetails,
                coords: location.coords,
                error: null,
              },
              lastKnownCoords: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              },
            }));

            // Update the localized address in the background
            get()
              .updateAddressTranslation()
              .catch((error) => {
                console.error("Failed to update address translation:", error);
              });
          } catch (error) {
            console.error("Failed to update location:", error);
            set((state) => ({
              locationDetails: {
                ...state.locationDetails,
                error: error instanceof Error ? error.message : "Failed to update location",
              },
            }));
          } finally {
            set({ isGettingLocation: false });
          }
        },

        setTimezone: async (tz) => {
          set({
            timezone: tz,
          });
        },

        // Check if city has changed
        checkCityChange: async () => {
          const lastCoords = get().lastKnownCoords;
          if (!lastCoords) {
            console.log("No previous coordinates available, skipping city change check");
            return false;
          }

          try {
            const currentLocation = await getLocationWithTimeout();

            // Calculate distance
            const distance = calculateDistance(
              lastCoords.latitude,
              lastCoords.longitude,
              currentLocation.coords.latitude,
              currentLocation.coords.longitude
            );

            console.log(`Distance from last location: ${distance.toFixed(2)}km`);

            if (distance > CITY_CHANGE_THRESHOLD) {
              // Get new city name to confirm it's actually different
              const [geocodedAddress] = await Location.reverseGeocodeAsync({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
              });

              const currentCity = get().locationDetails.address?.city;
              const newCity = geocodedAddress.city ?? "N/A";

              if (currentCity !== newCity) {
                console.log(`City changed from ${currentCity} to ${newCity}`);

                return true;
              }
            }

            return false;
          } catch (error) {
            console.error("Failed to check city change:", error);
            return false;
          }
        },

        setAutoUpdateLocation: (value: boolean) => {
          set({ autoUpdateLocation: value });
        },

        //  get localizedLocation (For display only)
        updateAddressTranslation: async () => {
          const location = get().locationDetails;

          const geocodeAdd = await get()
            .reverseGeocode({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              locale: appStore.getState().locale,
            })
            .catch((e) => console.error("Failed to update address translation:", e));

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
            console.error("Failed reverse geocode:", error);
            throw error as ErrorResponse;
          }
        },

        checkAndPromptCityChange: async () => {
          const state = get();
          const lastCoords = state.lastKnownCoords;

          if (!lastCoords || state.showCityChangeModal) {
            return; // Skip if no previous coords or modal already showing
          }

          // Check if 12 hours have passed since last check (throttling)
          if (state.lastCityChangeCheck) {
            const lastCheck = new Date(state.lastCityChangeCheck);
            const now = new Date();
            const hoursSinceLastCheck = (now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastCheck < 12) {
              console.log(
                `[Location] City change check throttled. Last check: ${hoursSinceLastCheck.toFixed(1)}h ago`
              );
              return;
            }
          }

          try {
            // Update timestamp for this check
            set({ lastCityChangeCheck: new Date().toISOString() });

            const currentLocation = await getLocationWithTimeout();

            // Calculate distance
            const distance = calculateDistance(
              lastCoords.latitude,
              lastCoords.longitude,
              currentLocation.coords.latitude,
              currentLocation.coords.longitude
            );

            console.log(`[Location] Distance from last location: ${distance.toFixed(2)}km`);

            if (distance > CITY_CHANGE_THRESHOLD) {
              // Get city names for comparison and display
              const [newGeocodedAddress] = await Location.reverseGeocodeAsync({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
              });

              const currentCity = get().locationDetails.address?.city || "Unknown";
              const newCity = newGeocodedAddress.city ?? "Unknown";

              if (currentCity !== newCity) {
                console.log(`[Location] City changed from ${currentCity} to ${newCity}`);

                // Set pending change and show modal
                set({
                  pendingCityChange: {
                    currentCity,
                    newCity,
                  },
                  showCityChangeModal: true,
                  cityChangeDetected: true,
                });
              } else {
                console.log(`[Location] Distance threshold exceeded but same city: ${currentCity}`);
              }
            } else {
              console.log(`[Location] City change check completed - no significant change`);
            }
          } catch (error) {
            console.error("[Location] Failed to check city change:", error);
          }
        },

        handleCityChangeUpdate: async () => {
          set({ isUpdatingLocation: true });

          try {
            await get().updateCurrentLocation();
            return true;
          } catch (error) {
            console.error("Failed to update location:", error);
            return false;
          } finally {
            set({ isUpdatingLocation: false });
          }
        },

        dismissCityChangeModal: () => {
          set({
            showCityChangeModal: false,
            pendingCityChange: null,
            cityChangeDetected: false,
          });
        },
      }),
      {
        name: "location-storage",
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          locationDetails: state.locationDetails,
          localizedLocation: state.localizedLocation,
          lastKnownCoords: state.lastKnownCoords,
          isLocationPermissionGranted: state.isLocationPermissionGranted,
          autoUpdateLocation: state.autoUpdateLocation,
          lastCityChangeCheck: state.lastCityChangeCheck,
        }),
      }
    ),
    { name: "LocationStore" }
  )
);

export default useLocationStore;
