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
  type PlaceRecord,
} from "@/types/location";
import {
  FIX_SOURCE,
  LOCATION_FAILURE,
  PLACE_UNKNOWN,
  type LocationFailure,
} from "@/constants/Location";
import {
  REUSE_FIX_MAX_AGE_MS,
  TRAVEL_MODE,
  type CityCheckOfferReason,
  type TravelMode,
} from "@/constants/CityCheck";
import type { CityCandidate, CityOffer } from "@/types/cityCheck";
import { LocationMode, type LocationModeValue } from "@/enums/location";
import type { ReverseGeocodeParams, ReverseGeocodeResponse } from "@/types/geocode";
import type { ErrorResponse } from "@/types/api";

// Stores
import appStore from "@/stores/app";
import { useCityCheckStore } from "@/stores/cityCheck";
import i18n from "@/localization/i18n";
import { AppLogger } from "@/utils/appLogger";

// Services
import { geocodeApi } from "@/api/geocodeApi";

// Utils
import {
  calculateDistance,
  CITY_CHANGE_THRESHOLD,
  LOCATION_REQUEST_TIMEOUT_EXTENDED,
  locationFailureOf,
  readLocation,
} from "@/utils/location";
import { trustedCityNear } from "@/utils/cityCheck/cityNear";
import { toPlaceMark } from "@/utils/cityCheck/marks";
import { resolveLocalizedName } from "@/utils/cities";
import { errorText } from "@/utils/errorText";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";

const log = AppLogger.create("location");

const FAILURE_KINDS: readonly unknown[] = Object.values(LOCATION_FAILURE);
const isLocationFailure = (value: unknown): value is LocationFailure =>
  FAILURE_KINDS.includes(value);

// A saved record may hold a free-text error, or miss or add fields; it
// restores to the fields of LocationDetails, defaults filling the gaps.
const restoredDetails = (saved: LocationDetails): LocationDetails => {
  const { coords, address, timezone, error, fix, countryCode, isLoading } = {
    ...initialLocationDetails,
    ...saved,
  };
  return {
    coords,
    address,
    timezone,
    error: isLocationFailure(error) ? error : null,
    fix,
    countryCode: typeof countryCode === "string" ? countryCodeOf(countryCode) : null,
    isLoading,
  };
};

/** An ISO country code as stored: upper case, or null when there is none. */
const countryCodeOf = (code: string | null | undefined): string | null =>
  code ? code.toUpperCase() : null;

const TRAVEL_MODES: readonly unknown[] = Object.values(TRAVEL_MODE);
const isTravelMode = (value: unknown): value is TravelMode => TRAVEL_MODES.includes(value);

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

/** Whether two points lie within the city-change distance of each other. */
const withinCityChange = (a: Coords, b: Coords): boolean =>
  calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude) <= CITY_CHANGE_THRESHOLD;

/** The device geocoder's answer; a failed one names no place. */
type DeviceGeocode =
  | { failed: true; address: null }
  | { failed: false; address: Location.LocationGeocodedAddress | null };

// The device geocoder's first address for a point.
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
  /** The place the stored times belong to, until the new place's land. */
  previousPlace: PlaceRecord | null;
  /** Moves on every write of the place's point. */
  placeRevision: number;
  /** Clears `previousPlace` once times land for `revision`'s place. */
  settlePlace: (revision: number) => void;
  localizedLocation: {
    country: string;
    city: string;
  };
  isLocationPermissionGranted: boolean;
  isGettingLocation: boolean;
  lastKnownCoords: Coords | null;
  /** Whether a move to another city is offered. */
  travelMode: TravelMode;
  locationMode: LocationModeValue;
  manualLocation: ManualLocation | null;
  /** When the city was chosen; the observation time of the stand-in Qibla fix. */
  manualLocationChosenAt: number | null;
  /** The city the device moved to, offered over the saved one; never saved. */
  cityOffer: CityOffer | null;
  /** Takes the device fix; it applies nothing once `wanted` turns false. */
  initializeLocation: (wanted?: () => boolean) => Promise<void>;
  /** Off drops a showing offer. */
  setTravelMode: (mode: TravelMode) => void;
  updateCurrentLocation: () => Promise<void>;
  /** Reads the device position; on success it replaces a chosen city. */
  adoptDeviceLocation: () => Promise<void>;
  /** Writes the offered city from its own fix; a stale fix reads the device again. */
  applyCityCandidate: (candidate: CityCandidate) => Promise<void>;
  reverseGeocode: (params: ReverseGeocodeParams) => Promise<ReverseGeocodeResponse>;
  updateAddressTranslation: () => Promise<boolean>;
  /** The place's zone, as the times fetched for it state. */
  setTimezone: (tz: string) => void;
  offerCity: (candidate: CityCandidate, reasons: CityCheckOfferReason[]) => void;
  /** Drops the offer and keeps the saved place for this trip. */
  keepCityOffer: () => void;
  /** Drops the offer and remembers nothing. */
  dismissCityOffer: () => void;
  /** Fills a missing country code for the place still at `revision`. */
  rememberCountryCode: (code: string, revision: number) => void;
  setManualLocation: (location: ManualLocation) => void;
  clearManualLocation: () => void;
};

type SetLocation = (partial: Partial<LocationStore>) => void;

/** The saved place as a whole; null before any place is verified. */
const placeRecordOf = (state: LocationStore): PlaceRecord | null => {
  if (state.lastKnownCoords === null) return null;
  const { coords, address, timezone, fix } = state.locationDetails;
  return {
    coords,
    address,
    timezone,
    fixSource: fix?.source ?? null,
    fixedAt: fix?.at ?? null,
    countryCode: state.locationDetails.countryCode,
    localizedLocation: state.localizedLocation,
    locationMode: state.locationMode,
    manualLocation: state.manualLocation,
  };
};

// Spread into every write of a new point. The first place written since the
// times last landed stays the previous one.
const placeWrite = (
  state: LocationStore
): Pick<LocationStore, "placeRevision" | "previousPlace"> => ({
  placeRevision: state.placeRevision + 1,
  previousPlace: state.previousPlace ?? placeRecordOf(state),
});

// Reads overlap, and one its caller gave up on still settles; only the
// newest read takes the flag down.
let readsStarted = 0;

/** Runs a device read with `isGettingLocation` up until the newest settles. */
const whileReading = async (set: SetLocation, read: () => Promise<void>): Promise<void> => {
  readsStarted += 1;
  const mine = readsStarted;
  set({ isGettingLocation: true });
  try {
    await read();
  } finally {
    if (mine === readsStarted) set({ isGettingLocation: false });
  }
};

export const useLocationStore = create<LocationStore>()(
  devtools(
    persist(
      (set, get) => ({
        locationDetails: initialLocationDetails,
        previousPlace: null,
        placeRevision: 0,
        localizedLocation: { country: "", city: "" },
        isLocationPermissionGranted: false,
        isGettingLocation: false,
        lastKnownCoords: null,
        travelMode: TRAVEL_MODE.ASK,
        cityOffer: null,
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
                      ...placeWrite(state),
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
              const revision = get().placeRevision;

              const geocodedAddress = (await deviceAddressAt(location.coords)).address;

              // Get localized version
              const localizedGeocode = await get()
                .reverseGeocode({
                  lat: location.coords.latitude,
                  lng: location.coords.longitude,
                  locale: appStore.getState().locale,
                })
                .catch((error) => {
                  log.w("Geocode", `localized address failed: ${errorText(error)}`);
                  return null;
                });

              if (!applies()) return;
              // A newer point was written while this one was named.
              if (get().placeRevision !== revision) {
                log.i("Init", "the place moved during the naming; the fix is not applied");
                return;
              }
              const timezone = localizedGeocode?.timezone || geocodedAddress?.timezone;
              if (!timezone) throw new Error(i18n.t("location.update.error"));

              set((state) => ({
                ...placeWrite(state),
                locationDetails: {
                  coords: location.coords,
                  address: {
                    country: geocodedAddress?.country ?? PLACE_UNKNOWN,
                    city: geocodedAddress?.city ?? PLACE_UNKNOWN,
                  },
                  timezone,
                  error: null,
                  fix: { source, at: location.timestamp },
                  countryCode: countryCodeOf(geocodedAddress?.isoCountryCode),
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
              }));
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
                ...placeWrite(state),
                locationDetails: {
                  ...state.locationDetails,
                  coords: location.coords,
                  address,
                  error: null,
                  fix: { source, at: location.timestamp },
                  countryCode: keepsName
                    ? state.locationDetails.countryCode
                    : countryCodeOf(geocoded.address?.isoCountryCode),
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
                  log.w("Geocode", `address translation failed: ${errorText(error)}`);
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

        applyCityCandidate: async (candidate) => {
          if (Date.now() - candidate.fixedAt > REUSE_FIX_MAX_AGE_MS) {
            return get().updateCurrentLocation();
          }
          const revision = get().placeRevision;
          // Row ids change when the full pack installs; the point finds the row.
          const row = await trustedCityNear(candidate.point);
          const geocoded = row ? null : (await deviceAddressAt(candidate.point)).address;
          // A newer point was written during the lookup.
          if (get().placeRevision !== revision) {
            log.i("Candidate", "the place moved during the lookup; the candidate is not applied");
            return;
          }
          const locale = appStore.getState().locale;
          const address = row
            ? { country: row.country.name, city: row.name }
            : geocoded && {
                country: geocoded.country ?? PLACE_UNKNOWN,
                city: geocoded.city ?? PLACE_UNKNOWN,
              };
          set((state) => ({
            ...placeWrite(state),
            locationDetails: {
              ...state.locationDetails,
              coords: {
                ...candidate.point,
                altitude: null,
                accuracy: candidate.accuracyKm === null ? null : candidate.accuracyKm * 1000,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              address,
              timezone:
                row?.timezone ??
                candidate.zone ??
                geocoded?.timezone ??
                state.locationDetails.timezone,
              error: null,
              fix: { source: FIX_SOURCE.FRESH, at: candidate.fixedAt },
              countryCode: countryCodeOf(
                candidate.countryCode ?? row?.countryCode ?? geocoded?.isoCountryCode
              ),
              isLoading: false,
            },
            lastKnownCoords: {
              latitude: candidate.point.latitude,
              longitude: candidate.point.longitude,
            },
            // Without a row, the device's names show until the translation lands.
            localizedLocation: row
              ? {
                  country: resolveLocalizedName(row.country.name, row.country.names, locale),
                  city: resolveLocalizedName(row.name, row.names, locale),
                }
              : { country: address?.country ?? "", city: address?.city ?? "" },
          }));
          log.i("Candidate", `offered city applied (${row ? "city row" : "device names"})`);
          if (row) return;
          get()
            .updateAddressTranslation()
            .catch((error) => {
              log.w("Geocode", `address translation failed: ${errorText(error)}`);
            });
        },

        settlePlace: (revision) => {
          set((state) => (revision === state.placeRevision ? { previousPlace: null } : {}));
        },

        setTimezone: (tz) => {
          set((state) => ({ locationDetails: { ...state.locationDetails, timezone: tz } }));
        },

        setTravelMode: (mode) => {
          set((state) => ({
            travelMode: mode,
            cityOffer: mode === TRAVEL_MODE.OFF ? null : state.cityOffer,
          }));
        },

        //  get localizedLocation (For display only)
        updateAddressTranslation: async () => {
          const location = get().locationDetails;
          const asked = appStore.getState().locale;
          const revision = get().placeRevision;

          const geocodeAdd = await get()
            .reverseGeocode({
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              locale: asked,
            })
            .catch((e) => {
              log.w("Geocode", `address translation failed: ${errorText(e)}`);
            });

          // A later language switch owns the name; this answer is for the old one.
          if (appStore.getState().locale !== asked) return false;
          // The answer names a point that is not the saved one.
          if (get().placeRevision !== revision) return false;

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

        offerCity: (candidate, reasons) => {
          set({ cityOffer: { candidate, reasons } });
        },

        keepCityOffer: () => {
          const offer = get().cityOffer;
          if (offer)
            useCityCheckStore
              .getState()
              .keep(toPlaceMark(offer.candidate.point, Date.now(), offer.candidate.countryCode));
          set({ cityOffer: null });
        },

        dismissCityOffer: () => {
          set({ cityOffer: null });
        },

        // A late geocoder answer never lands on a newer place or over a code.
        rememberCountryCode: (code, revision) => {
          set((state) =>
            state.placeRevision === revision && state.locationDetails.countryCode === null
              ? { locationDetails: { ...state.locationDetails, countryCode: countryCodeOf(code) } }
              : {}
          );
        },

        // lastKnownCoords is what marks a position prayer-ready; without it the prayer
        // times store keeps reporting the default Makkah fallback.
        setManualLocation: (location) => {
          set((state) => ({
            ...placeWrite(state),
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
              countryCode: countryCodeOf(location.countryCode),
              isLoading: false,
            },
            localizedLocation: { country: location.country.name, city: location.name },
            cityOffer: null,
            lastKnownCoords: { latitude: location.latitude, longitude: location.longitude },
          }));
          log.i("Manual", "manual location set");
        },

        clearManualLocation: () => {
          set((state) => ({
            ...placeWrite(state),
            locationMode: LocationMode.DEVICE,
            manualLocation: null,
            manualLocationChosenAt: null,
            lastKnownCoords: null,
          }));
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
          travelMode: state.travelMode,
          // 2.x reads this flag; true is "ask", false is "no updates".
          autoUpdateLocation: state.travelMode === TRAVEL_MODE.ASK,
          locationMode: state.locationMode,
          manualLocation: state.manualLocation,
          manualLocationChosenAt: state.manualLocationChosenAt,
          previousPlace: state.previousPlace,
          placeRevision: state.placeRevision,
        }),
        // A saved DEVICE mode would read the device position in a screenshot build.
        merge: (persisted, current) => {
          const {
            autoUpdateLocation,
            travelMode,
            ...saved
          }: Partial<LocationStore> & { autoUpdateLocation?: unknown } =
            typeof persisted === "object" && persisted !== null ? persisted : {};
          return {
            ...current,
            ...saved,
            travelMode: isTravelMode(travelMode)
              ? travelMode
              : autoUpdateLocation === false
                ? TRAVEL_MODE.OFF
                : TRAVEL_MODE.ASK,
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
