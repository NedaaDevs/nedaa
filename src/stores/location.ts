import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import * as Location from "@/adapters/location";

// Types
import {
  initialLocationDetails,
  type Coords,
  type LocationDetails,
  type ManualLocation,
} from "@/types/location";
import {
  LOCATION_FAILURE,
  PLACE_UNKNOWN,
  knownPlaceName,
  type LocationFailure,
} from "@/constants/Location";
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
import { errorText } from "@/utils/errorText";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";

const log = AppLogger.create("location");

const FAILURE_KINDS: readonly unknown[] = Object.values(LOCATION_FAILURE);
const isLocationFailure = (value: unknown): value is LocationFailure =>
  FAILURE_KINDS.includes(value);

// An older saved record may hold a free-text error, lack a newer field or
// keep a dropped one; only the fields a record has now are restored.
const restoredDetails = (saved: LocationDetails): LocationDetails => {
  const { coords, address, timezone, error, fix, isLoading } = {
    ...initialLocationDetails,
    ...saved,
  };
  return {
    coords,
    address,
    timezone,
    error: isLocationFailure(error) ? error : null,
    fix,
    isLoading,
  };
};

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

/** The saved city and the one the device is in now, both device-named. */
type CityChangeOffer = { currentCity: string; newCity: string };

/** Whether two points lie within the city-change distance of each other. */
const withinCityChange = (a: Coords, b: Coords): boolean =>
  calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude) <= CITY_CHANGE_THRESHOLD;

/** The device geocoder's answer; a failed one names no place. */
type DeviceGeocode =
  | { failed: true; address: null }
  | { failed: false; address: Location.LocationGeocodedAddress | null };

// City-change checks compare names from this one geocoder, so every stored
// device address comes from it.
const deviceAddressAt = async ({ latitude, longitude }: Coords): Promise<DeviceGeocode> => {
  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
    return { failed: false, address: addresses[0] ?? null };
  } catch (error) {
    log.w("Geocode", `device address failed: ${errorText(error)}`);
    return { failed: true, address: null };
  }
};

export type LocationStore = {
  locationDetails: LocationDetails;
  localizedLocation: {
    country: string;
    city: string;
  };
  isLocationPermissionGranted: boolean;
  isGettingLocation: boolean;
  lastKnownCoords: Coords | null;
  autoUpdateLocation: boolean;
  locationMode: LocationModeValue;
  manualLocation: ManualLocation | null;
  /** When the city was chosen; the observation time of the stand-in Qibla fix. */
  manualLocationChosenAt: number | null;
  /** The city-change sheet is up; its offer stays until it has closed. */
  showCityChangeModal: boolean;
  pendingCityChange: CityChangeOffer | null;
  /** The last new city offered this session; it is not offered again. */
  cityOffered: string | null;
  /** Takes the device fix; it applies nothing once `wanted` turns false. */
  initializeLocation: (wanted?: () => boolean) => Promise<void>;
  setAutoUpdateLocation: (value: boolean) => void;
  updateCurrentLocation: () => Promise<void>;
  /** Reads the device position; on success it replaces a chosen city. */
  adoptDeviceLocation: () => Promise<void>;
  reverseGeocode: (params: ReverseGeocodeParams) => Promise<ReverseGeocodeResponse>;
  updateAddressTranslation: () => Promise<boolean>;
  /** The place's zone, as the times fetched for it state. */
  setTimezone: (tz: string) => void;
  checkAndPromptCityChange: () => Promise<void>;
  /** Puts the city-change sheet up with this offer. */
  offerCityChange: (offer: CityChangeOffer) => void;
  /** Takes the sheet down; its offer stays drawn while it leaves. */
  closeCityChange: () => void;
  /** Drops the offer once the sheet is gone; its city is not offered again. */
  clearCityChange: () => void;
  setManualLocation: (location: ManualLocation) => void;
  clearManualLocation: () => void;
};

type SetLocation = (partial: Partial<LocationStore>) => void;

// Reads overlap, and one its caller gave up on still settles; only the
// newest read takes the flag down.
let readsStarted = 0;

/** Runs a device read with `isGettingLocation` up until the newest settles. */
const whileReading = async <T>(set: SetLocation, read: () => Promise<T>): Promise<T> => {
  readsStarted += 1;
  const mine = readsStarted;
  set({ isGettingLocation: true });
  try {
    return await read();
  } finally {
    if (mine === readsStarted) set({ isGettingLocation: false });
  }
};

export const useLocationStore = create<LocationStore>()(
  devtools(
    persist(
      (set, get) => ({
        locationDetails: initialLocationDetails,
        localizedLocation: { country: "", city: "" },
        isLocationPermissionGranted: false,
        isGettingLocation: false,
        lastKnownCoords: null,
        autoUpdateLocation: true,
        showCityChangeModal: false,
        pendingCityChange: null,
        cityOffered: null,
        // A screenshot build starts on its seeded city; restore below keeps it there.
        locationMode: IS_SCREENSHOT_MODE ? LocationMode.MANUAL : LocationMode.DEVICE,
        manualLocation: null,
        manualLocationChosenAt: null,
        // Initialize location when permission is granted
        initializeLocation: (wanted = () => true) =>
          whileReading(set, async () => {
            // A city chosen during the fix is the user's, and a caller that
            // gave up has moved on; either way the fix leaves the place.
            const applies = () => {
              if (!wanted()) {
                log.i("Init", "the caller gave up on the fix; the device place is not applied");
                return false;
              }
              if (get().locationMode === LocationMode.DEVICE) return true;
              log.i("Init", "a city was chosen during the fix; the device place is not applied");
              return false;
            };
            // A failure after a good read is the naming's, not the read's.
            let read = false;
            try {
              // Get initial location with timeout protection
              const { location, source } = await readLocation();
              read = true;
              log.i("Init", `initial location retrieved (${source})`);
              if (!applies()) return;

              // A saved place stands until the fix's timezone resolves; with
              // none, the fix is kept even when address services are down.
              set((state) =>
                state.lastKnownCoords
                  ? { isLocationPermissionGranted: true }
                  : {
                      locationDetails: {
                        ...state.locationDetails,
                        coords: location.coords,
                        error: null,
                        fix: { source, at: location.timestamp },
                        isLoading: false,
                      },
                      isLocationPermissionGranted: true,
                    }
              );

              const geocodedAddress = (await deviceAddressAt(location.coords)).address;

              // Get localized version
              const localizedGeocode = await get()
                .reverseGeocode({
                  lat: location.coords.latitude,
                  lng: location.coords.longitude,
                  locale: appStore.getState().locale,
                })
                .catch((error) => {
                  log.w(
                    "Geocode",
                    `localized address failed: ${(error as Error)?.message ?? error}`
                  );
                  return null;
                });

              if (!applies()) return;
              const timezone = localizedGeocode?.timezone || geocodedAddress?.timezone;
              if (!timezone) throw new Error(i18n.t("location.update.error"));

              set({
                locationDetails: {
                  coords: location.coords,
                  address: {
                    country: geocodedAddress?.country ?? PLACE_UNKNOWN,
                    city: geocodedAddress?.city ?? PLACE_UNKNOWN,
                  },
                  timezone,
                  error: null,
                  fix: { source, at: location.timestamp },
                  isLoading: false,
                },
                localizedLocation: {
                  country:
                    localizedGeocode?.countryName || geocodedAddress?.country || PLACE_UNKNOWN,
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
              // An abandoned fix: an info log, no device error.
              if (!wanted() || get().locationMode !== LocationMode.DEVICE) {
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
            }
          }),

        updateCurrentLocation: () =>
          whileReading(set, async () => {
            // A city chosen during the read is the user's; the read leaves it.
            const choice = placeChoiceOf(get());
            try {
              const { location, source } = await readLocation(LOCATION_REQUEST_TIMEOUT_EXTENDED);
              log.i("Update", `location updated (${source})`);
              const geocoded = await deviceAddressAt(location.coords);
              if (choiceMoved(get(), choice)) {
                log.i("Update", "a city was chosen during the read; the fix is not applied");
                return;
              }

              // A failed geocode keeps the device's name within its saved city.
              const saved = get().lastKnownCoords;
              const keepsName =
                geocoded.failed &&
                choice.locationMode === LocationMode.DEVICE &&
                saved !== null &&
                withinCityChange(saved, location.coords);
              const address = keepsName
                ? get().locationDetails.address
                : geocoded.address && {
                    country: geocoded.address.country ?? PLACE_UNKNOWN,
                    city: geocoded.address.city ?? PLACE_UNKNOWN,
                  };
              set((state) => ({
                locationDetails: {
                  ...state.locationDetails,
                  coords: location.coords,
                  address,
                  error: null,
                  fix: { source, at: location.timestamp },
                },
                lastKnownCoords: {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                },
                // A new city's own name shows until its translation lands.
                ...(address?.city === state.locationDetails.address?.city
                  ? {}
                  : {
                      localizedLocation: {
                        city: address?.city ?? "",
                        country: address?.country ?? "",
                      },
                    }),
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
            }
          }),

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

        setTimezone: (tz) => {
          set((state) => ({ locationDetails: { ...state.locationDetails, timezone: tz } }));
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
          const before = get();
          const savedCoords = before.lastKnownCoords;
          if (!savedCoords || before.showCityChangeModal) return;

          // A city the user chose is never second-guessed against the device position;
          // the prompt belongs to the mode that is actually tracking the device.
          if (before.locationMode === LocationMode.MANUAL) return;

          // The offer names the saved city; without a name there is no offer.
          const currentCity = knownPlaceName(before.locationDetails.address?.city);
          if (!currentCity) {
            log.i("CityChange", "the saved city has no name; no offer");
            return;
          }

          try {
            const fix = await getLocationWithTimeout();
            const distance = calculateDistance(
              savedCoords.latitude,
              savedCoords.longitude,
              fix.coords.latitude,
              fix.coords.longitude
            );
            log.d("CityChange", `${distance.toFixed(2)} km from the saved place`);
            if (distance <= CITY_CHANGE_THRESHOLD) return;

            const newCity = knownPlaceName((await deviceAddressAt(fix.coords)).address?.city);
            const state = get();
            // Only against the place still saved, and never over onboarding.
            if (state.lastKnownCoords !== savedCoords || appStore.getState().isFirstRun) {
              log.i("CityChange", "the saved place or the flow changed during the check");
              return;
            }
            if (!newCity || newCity === currentCity || newCity === state.cityOffered) {
              log.i("CityChange", "no new named city to offer");
              return;
            }
            log.i("CityChange", `offering ${newCity} over ${currentCity}`);
            get().offerCityChange({ currentCity, newCity });
          } catch (error) {
            // Runs on every launch, so a declined permission is an expected quiet skip.
            if (error instanceof LocationPermissionError) return;
            log.w("CityChange", `city change check failed: ${errorText(error)}`);
          }
        },

        offerCityChange: (offer) => {
          set({ pendingCityChange: offer, showCityChangeModal: true });
        },

        closeCityChange: () => {
          set({ showCityChangeModal: false });
        },

        clearCityChange: () => {
          set((state) => ({
            showCityChangeModal: false,
            pendingCityChange: null,
            cityOffered: state.pendingCityChange?.newCity ?? state.cityOffered,
          }));
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
              fix: null,
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
            locationDetails: restoredDetails(saved.locationDetails ?? current.locationDetails),
            ...(IS_SCREENSHOT_MODE ? { locationMode: LocationMode.MANUAL } : {}),
          };
        },
      }
    ),
    { name: "LocationStore" }
  )
);

export default useLocationStore;
