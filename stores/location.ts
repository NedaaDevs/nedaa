import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import * as Location from "expo-location";

// Types
import { LocationStore, initialLocationDetails } from "@/types/location";

// Utils
import { mapToLocalStatus } from "@/utils/location";

// Enums
import { LocalPermissionStatus } from "@/enums/location";

// Stores

export const useLocationStore = create<LocationStore>()(
  devtools(
    persist(
      (set, get) => ({
        permissions: {
          status: LocalPermissionStatus.UNDETERMINED,
          canRequestAgain: true,
        },
        locationDetails: initialLocationDetails,

        checkPermissions: async () => {
          try {
            const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
            set({
              permissions: {
                status: mapToLocalStatus(status),
                canRequestAgain: canAskAgain,
              },
            });
          } catch (error) {
            console.error("Location permission check failed:", error);
            set({
              permissions: {
                status: LocalPermissionStatus.UNDETERMINED,
                canRequestAgain: true,
              },
            });
          }
        },

        requestPermissions: async () => {
          try {
            const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
            const newState = {
              status: mapToLocalStatus(status),
              canRequestAgain: canAskAgain,
            };
            set({ permissions: newState });

            if (newState.status === LocalPermissionStatus.GRANTED) {
              await get().getCurrentLocation();
            }
            return newState.status === LocalPermissionStatus.GRANTED;
          } catch (error) {
            console.error("Location permission request failed:", error);
            return false;
          }
        },

        getCurrentLocation: async () => {
          set((state) => ({
            locationDetails: {
              ...state.locationDetails,
              isLoading: true,
              error: null,
            },
          }));

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
        // Only persist the permissions/location details
        partialize: (state) => ({
          permissions: {
            ...state.permissions,
          },
          locationDetails: {
            coords: state.locationDetails.coords,
            address: state.locationDetails.address,
            timezone: state.locationDetails.timezone,
            error: null,
            isLoading: false,
          },
        }),
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
