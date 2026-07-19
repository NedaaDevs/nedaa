import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import * as Location from "@/adapters/location";

// Types
import { initialLocationDetails, type LocationDetails } from "@/types/location";
import type { ReverseGeocodeParams, ReverseGeocodeResponse } from "@/types/geocode";
import type { ErrorResponse } from "@/types/api";

// Stores
import appStore from "@/stores/app";
import i18n from "@/localization/i18n";
import { AppLogger } from "@/utils/appLogger";

// Services
import { geocodeApi } from "@/api/geocodeApi";

// Utils
import { getLocationWithTimeout, calculateDistance, CITY_CHANGE_THRESHOLD } from "@/utils/location";

const log = AppLogger.create("location");

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
  initializeLocation: () => Promise<void>;
  setAutoUpdateLocation: (value: boolean) => void;
  updateCurrentLocation: () => Promise<void>;
  checkCityChange: () => Promise<boolean>;
  reverseGeocode: (params: ReverseGeocodeParams) => Promise<ReverseGeocodeResponse>;
  updateAddressTranslation: () => Promise<boolean>;
  setTimezone: (tz: string) => Promise<void>;
  checkAndPromptCityChange: () => Promise<void>;
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
        // Initialize location when permission is granted
        initializeLocation: async () => {
          const previousState = get();
          const previousLastKnownCoords = previousState.lastKnownCoords;
          const previousVerifiedLocation = previousLastKnownCoords
            ? {
                locationDetails: previousState.locationDetails,
                localizedLocation: previousState.localizedLocation,
                lastKnownCoords: previousLastKnownCoords,
              }
            : null;
          set({ isGettingLocation: true });
          try {
            // Get initial location with timeout protection
            const location = await getLocationWithTimeout();
            log.i("Init", "initial location retrieved");

            // Keep an accurate fix even when address services are unavailable.
            set((state) => ({
              locationDetails: {
                ...state.locationDetails,
                coords: location.coords,
                error: null,
                isLoading: false,
              },
              // A coordinate becomes prayer-ready only after its timezone is resolved.
              lastKnownCoords: null,
              isLocationPermissionGranted: true,
            }));

            const [geocodedAddress] = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }).catch((error) => {
              log.w("Geocode", `device address failed: ${(error as Error)?.message ?? error}`);
              return [];
            });

            // Get localized version
            const localizedGeocode = await get()
              .reverseGeocode({
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                locale: appStore.getState().locale,
              })
              .catch((error) => {
                log.w("Geocode", `localized address failed: ${(error as Error)?.message ?? error}`);
                return null;
              });

            const timezone = localizedGeocode?.timezone || geocodedAddress?.timezone;
            if (!timezone) {
              if (previousVerifiedLocation) {
                set(previousVerifiedLocation);
              }
              throw new Error(i18n.t("location.update.error"));
            }

            set({
              locationDetails: {
                coords: location.coords,
                address: {
                  country: geocodedAddress?.country ?? localizedGeocode?.countryName ?? "N/A",
                  city: geocodedAddress?.city ?? localizedGeocode?.city ?? "N/A",
                },
                timezone,
                error: null,
                isLoading: false,
              },
              localizedLocation: {
                country: localizedGeocode?.countryName || geocodedAddress?.country || "N/A",
                city: localizedGeocode?.city || geocodedAddress?.city || "N/A",
              },
              lastKnownCoords: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              },
              isLocationPermissionGranted: true,
            });
          } catch (error) {
            const cause =
              error instanceof Error ? error : new Error("Failed to initialize location");
            log.e("Init", "initialize location failed", cause);
            set((state) => ({
              locationDetails: {
                ...state.locationDetails,
                error: cause.message,
                isLoading: false,
              },
            }));
            throw cause;
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
                log.w(
                  "Geocode",
                  `address translation failed: ${(error as Error)?.message ?? error}`
                );
              });
          } catch (error) {
            const cause = error instanceof Error ? error : new Error("Failed to update location");
            log.e("Update", "update location failed", cause);
            set((state) => ({
              locationDetails: {
                ...state.locationDetails,
                error: cause.message,
              },
            }));
            throw cause;
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
                log.i("CityChange", `city changed: ${currentCity} -> ${newCity}`);

                return true;
              }
            }

            return false;
          } catch (error) {
            log.w("CityChange", `check failed: ${(error as Error)?.message ?? error}`);
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
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              locale: appStore.getState().locale,
            })
            .catch((e) => {
              log.w("Geocode", `address translation failed: ${(e as Error)?.message ?? e}`);
            });

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
              lat: params.lat,
              lng: params.lng,
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
            return;
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
        }),
      }
    ),
    { name: "LocationStore" }
  )
);

export default useLocationStore;
