import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import * as Location from "@/adapters/location";

// Types
import {
  initialLocationDetails,
  type LocationDetails,
  type ManualLocation,
} from "@/types/location";
import { LOCATION_FAILURE, PLACE_UNKNOWN, type LocationFailure } from "@/constants/Location";
import { LocationMode, type LocationModeValue } from "@/enums/location";
import type { ReverseGeocodeParams, ReverseGeocodeResponse } from "@/types/geocode";
import type { ErrorResponse } from "@/types/api";

// Stores
import appStore from "@/stores/app";
import i18n from "@/localization/i18n";
import { AppLogger } from "@/utils/appLogger";

// Services
import { geocodeApi } from "@/api/geocodeApi";

// Utils
import {
  getLocationWithTimeout,
  calculateDistance,
  CITY_CHANGE_THRESHOLD,
  LOCATION_REQUEST_TIMEOUT_EXTENDED,
  LocationPermissionError,
  locationFailureOf,
  readLocation,
} from "@/utils/location";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";

const log = AppLogger.create("location");

const FAILURE_KINDS: readonly unknown[] = Object.values(LOCATION_FAILURE);
const isLocationFailure = (value: unknown): value is LocationFailure =>
  FAILURE_KINDS.includes(value);

// An older saved record may hold free-text errors or lack newer fields.
const withKnownError = (details: LocationDetails): LocationDetails => ({
  ...initialLocationDetails,
  ...details,
  error: isLocationFailure(details.error) ? details.error : null,
});

type Coords = { latitude: number; longitude: number };

/** How the place is set: the mode, and the city chosen and when. */
type PlaceChoice = {
  locationMode: LocationModeValue;
  manualLocation: ManualLocation | null;
  manualLocationChosenAt: number | null;
};

const placeChoiceOf = ({
  locationMode,
  manualLocation,
  manualLocationChosenAt,
}: PlaceChoice): PlaceChoice => ({ locationMode, manualLocation, manualLocationChosenAt });

/** True once the mode or the chosen city moved since `before`. */
const choiceMoved = (now: PlaceChoice, before: PlaceChoice): boolean =>
  now.locationMode !== before.locationMode ||
  now.manualLocation !== before.manualLocation ||
  now.manualLocationChosenAt !== before.manualLocationChosenAt;

// City-change checks compare names from this one geocoder, so every stored
// device address comes from it.
const deviceAddressAt = async ({
  latitude,
  longitude,
}: Coords): Promise<Location.LocationGeocodedAddress | null> => {
  const addresses = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(
    (error: unknown) => {
      log.w("Geocode", `device address failed: ${(error as Error)?.message ?? error}`);
      return [];
    }
  );
  return addresses[0] ?? null;
};

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
  locationMode: LocationModeValue;
  manualLocation: ManualLocation | null;
  /** When the city was chosen; the observation time of the stand-in Qibla fix. */
  manualLocationChosenAt: number | null;
  showCityChangeModal: boolean;
  pendingCityChange: {
    currentCity: string;
    newCity: string;
  } | null;
  initializeLocation: () => Promise<void>;
  setAutoUpdateLocation: (value: boolean) => void;
  updateCurrentLocation: () => Promise<void>;
  /** Reads the device position; on success it replaces a chosen city. */
  adoptDeviceLocation: () => Promise<void>;
  reverseGeocode: (params: ReverseGeocodeParams) => Promise<ReverseGeocodeResponse>;
  updateAddressTranslation: () => Promise<boolean>;
  setTimezone: (tz: string) => Promise<void>;
  checkAndPromptCityChange: () => Promise<void>;
  dismissCityChangeModal: () => void;
  setManualLocation: (location: ManualLocation) => void;
  clearManualLocation: () => void;
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
        // A screenshot build starts on its seeded city; restore below keeps it there.
        locationMode: IS_SCREENSHOT_MODE ? LocationMode.MANUAL : LocationMode.DEVICE,
        manualLocation: null,
        manualLocationChosenAt: null,
        // Initialize location when permission is granted
        initializeLocation: async () => {
          // A city chosen during the fix is the user's; the fix leaves it.
          const stillAutomatic = () => {
            if (get().locationMode === LocationMode.DEVICE) return true;
            log.i("Init", "a city was chosen during the fix; the device place is not applied");
            return false;
          };
          set({ isGettingLocation: true });
          // A failure after a good read is the naming's, not the read's.
          let read = false;
          try {
            // Get initial location with timeout protection
            const { location, source } = await readLocation();
            read = true;
            log.i("Init", `initial location retrieved (${source})`);
            if (!stillAutomatic()) return;

            // A saved place stands until the fix's timezone resolves; with none, the
            // fix is kept even when address services are unavailable.
            set((state) =>
              state.lastKnownCoords
                ? { isLocationPermissionGranted: true }
                : {
                    locationDetails: {
                      ...state.locationDetails,
                      coords: location.coords,
                      error: null,
                      fixSource: source,
                      fixedAt: location.timestamp,
                      isLoading: false,
                    },
                    isLocationPermissionGranted: true,
                  }
            );

            const geocodedAddress = await deviceAddressAt(location.coords);

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

            if (!stillAutomatic()) return;
            const timezone = localizedGeocode?.timezone || geocodedAddress?.timezone;
            if (!timezone) throw new Error(i18n.t("location.update.error"));

            set({
              locationDetails: {
                coords: location.coords,
                address: {
                  country:
                    geocodedAddress?.country ?? localizedGeocode?.countryName ?? PLACE_UNKNOWN,
                  city: geocodedAddress?.city ?? localizedGeocode?.city ?? PLACE_UNKNOWN,
                },
                timezone,
                error: null,
                fixSource: source,
                fixedAt: location.timestamp,
                isLoading: false,
              },
              localizedLocation: {
                country: localizedGeocode?.countryName || geocodedAddress?.country || PLACE_UNKNOWN,
                city: localizedGeocode?.city || geocodedAddress?.city || PLACE_UNKNOWN,
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
            // A chosen city abandons the fix: an info log, no device error.
            if (get().locationMode !== LocationMode.DEVICE) {
              log.i("Init", `abandoned fix failed: ${cause.message}`);
            } else {
              log.e("Init", "initialize location failed", cause);
              set((state) => ({
                locationDetails: {
                  ...state.locationDetails,
                  error: read ? null : locationFailureOf(cause),
                  isLoading: false,
                },
              }));
            }
            throw cause;
          } finally {
            set({ isGettingLocation: false });
          }
        },

        updateCurrentLocation: async () => {
          // A city chosen during the read is the user's; the read leaves it.
          const choice = placeChoiceOf(get());
          set({ isGettingLocation: true });
          try {
            const { location, source } = await readLocation(LOCATION_REQUEST_TIMEOUT_EXTENDED);
            log.i("Update", `location updated (${source})`);
            const geocodedAddress = await deviceAddressAt(location.coords);
            if (choiceMoved(get(), choice)) {
              log.i("Update", "a city was chosen during the read; the fix is not applied");
              return;
            }

            // An unnamed fix clears the address; an old city name would hide a move.
            set((state) => ({
              locationDetails: {
                ...state.locationDetails,
                coords: location.coords,
                address: geocodedAddress && {
                  country: geocodedAddress.country ?? PLACE_UNKNOWN,
                  city: geocodedAddress.city ?? PLACE_UNKNOWN,
                },
                error: null,
                fixSource: source,
                fixedAt: location.timestamp,
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
            if (choiceMoved(get(), choice)) {
              log.i("Update", `abandoned read failed: ${cause.message}`);
              return;
            }
            log.e("Update", "update location failed", cause);
            set((state) => ({
              locationDetails: {
                ...state.locationDetails,
                error: locationFailureOf(cause),
              },
            }));
            throw cause;
          } finally {
            set({ isGettingLocation: false });
          }
        },

        adoptDeviceLocation: async () => {
          const choice = placeChoiceOf(get());
          await get().updateCurrentLocation();
          // The read did not apply over a city chosen while it ran.
          if (choiceMoved(get(), choice)) return;
          const address = get().locationDetails.address;
          // The chosen city's name would stand until the translated name lands.
          set({
            locationMode: LocationMode.DEVICE,
            manualLocation: null,
            manualLocationChosenAt: null,
            localizedLocation: { city: address?.city ?? "", country: address?.country ?? "" },
          });
          log.i("Device", "device location adopted over the chosen city");
        },

        setTimezone: async (tz) => {
          set({
            timezone: tz,
          });
        },

        setAutoUpdateLocation: (value: boolean) => {
          set({ autoUpdateLocation: value });
        },

        //  get localizedLocation (For display only)
        updateAddressTranslation: async () => {
          const location = get().locationDetails;
          const asked = appStore.getState().locale;

          const geocodeAdd = await get()
            .reverseGeocode({
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              locale: asked,
            })
            .catch((e) => {
              log.w("Geocode", `address translation failed: ${(e as Error)?.message ?? e}`);
            });

          // A later language switch owns the name; this answer is for the old one.
          if (appStore.getState().locale !== asked) return false;

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

          // A city the user chose is never second-guessed against the device position;
          // the prompt belongs to the mode that is actually tracking the device.
          if (state.locationMode === LocationMode.MANUAL) {
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
              // With no name for the new place there is nothing to offer.
              const newGeocodedAddress = await deviceAddressAt(currentLocation.coords);
              if (!newGeocodedAddress) {
                log.i("CityChange", "new place has no device address; no prompt");
                return;
              }

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
            // Runs on every launch, so a declined permission is an expected quiet skip.
            if (error instanceof LocationPermissionError) return;
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

        // lastKnownCoords is what marks a position prayer-ready; without it the prayer
        // times store keeps reporting the default Makkah fallback.
        setManualLocation: (location) => {
          set((state) => ({
            locationMode: LocationMode.MANUAL,
            manualLocation: location,
            manualLocationChosenAt: Date.now(),
            locationDetails: {
              ...state.locationDetails,
              coords: {
                ...state.locationDetails.coords,
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: null,
              },
              address: { country: location.country.name, city: location.name },
              timezone: location.timezone,
              error: null,
              fixSource: null,
              fixedAt: null,
              isLoading: false,
            },
            localizedLocation: { country: location.country.name, city: location.name },
            lastKnownCoords: { latitude: location.latitude, longitude: location.longitude },
          }));
          log.i("Manual", `manual location set to ${location.name} (${location.timezone})`);
        },

        clearManualLocation: () => {
          set({
            locationMode: LocationMode.DEVICE,
            manualLocation: null,
            manualLocationChosenAt: null,
            lastKnownCoords: null,
          });
          log.i("Manual", "manual location cleared; the device location will be used");
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
          locationMode: state.locationMode,
          manualLocation: state.manualLocation,
          manualLocationChosenAt: state.manualLocationChosenAt,
        }),
        // A saved DEVICE mode would read the device position in a screenshot build.
        merge: (persisted, current) => {
          const saved: Partial<LocationStore> =
            typeof persisted === "object" && persisted !== null ? persisted : {};
          return {
            ...current,
            ...saved,
            locationDetails: withKnownError(saved.locationDetails ?? current.locationDetails),
            ...(IS_SCREENSHOT_MODE ? { locationMode: LocationMode.MANUAL } : {}),
          };
        },
      }
    ),
    { name: "LocationStore" }
  )
);

export default useLocationStore;
