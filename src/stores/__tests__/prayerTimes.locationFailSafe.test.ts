import Storage from "expo-sqlite/kv-store";

import { TIMES_FETCH, type TimesFetch } from "@/constants/PrayerTimes";
import { LocationMode } from "@/enums/location";
import { useLocationStore, type LocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { initialLocationDetails, type ManualLocation } from "@/types/location";
import { RIYADH_DAY } from "@/test-helpers/prayerDay";
import { later, until } from "@/test-helpers/promises";
import { AppLogger } from "@/utils/appLogger";

const mockGetLocationWithTimeout = jest.fn();
const mockCheckLocationPermission = jest.fn();
const mockGetPrayerTimesByDateRange = jest.fn();
const mockGetPrayerTimesByDate = jest.fn();
const mockReverseGeocodeAsync = jest.fn();
const mockReverseGeocodeApi = jest.fn();

jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: jest.fn(async () => {}) }));
jest.mock("@/adapters/location", () => ({
  reverseGeocodeAsync: (...args: unknown[]) => mockReverseGeocodeAsync(...args),
}));

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

// The store reads a fix with its source; these tests drive the position alone.
jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  calculateDistance: jest.fn(),
  checkLocationPermission: (...args: unknown[]) => mockCheckLocationPermission(...args),
  getLocationWithTimeout: (...args: unknown[]) => mockGetLocationWithTimeout(...args),
  readLocation: async (...args: unknown[]) => ({
    location: await mockGetLocationWithTimeout(...args),
    source: jest.requireActual("@/constants/Location").FIX_SOURCE.FRESH,
  }),
}));

jest.mock("@/stores/app", () => ({
  __esModule: true,
  default: {
    getState: () => ({ locale: "en" }),
  },
}));

jest.mock("@/stores/providerSettings", () => ({
  __esModule: true,
  default: {
    getState: () => ({ currentProviderId: "aladhan" }),
  },
}));

jest.mock("@/api/geocodeApi", () => ({
  geocodeApi: {
    reverseGeocode: (...args: unknown[]) => mockReverseGeocodeApi(...args),
  },
}));

jest.mock("@/api/prayerTimes.api", () => ({
  prayerTimesApi: { get: jest.fn(), getProviders: jest.fn() },
}));

jest.mock("@/services/db", () => ({
  PrayerTimesDB: {
    getPrayerTimesByDateRange: (...args: unknown[]) => mockGetPrayerTimesByDateRange(...args),
    getPrayerTimesByDate: (...args: unknown[]) => mockGetPrayerTimesByDate(...args),
    insertPrayerTimes: jest.fn(),
    cleanData: jest.fn(() => Promise.resolve(true)),
  },
}));

jest.mock("@/adapters/providers", () => ({
  getAdapterByProviderId: jest.fn(),
}));

// One logger per domain, so a test can read what a store logged.
jest.mock("@/utils/appLogger", () => {
  const logs = new Map<string, Record<"d" | "i" | "w" | "e", jest.Mock>>();
  const create = (domain: string) => {
    const log = logs.get(domain) ?? { d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() };
    logs.set(domain, log);
    return log;
  };
  return { AppLogger: { create } };
});

jest.mock("@/utils/date", () => ({
  dateToInt: (date: Date) => Number(date.toISOString().slice(0, 10).replaceAll("-", "")),
  getTimezoneMonth: () => 7,
  getTimezoneYear: () => 2026,
  timeZonedNow: () => new Date("2026-07-19T12:00:00.000Z"),
}));

jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("expo-widgets", () => ({ refreshAllWidgets: jest.fn() }));

const locationLog = AppLogger.create("location");
const prayerTimesLog = AppLogger.create("prayertimes");

const resetStores = () => {
  useLocationStore.setState({
    locationMode: LocationMode.DEVICE,
    manualLocation: null,
    locationDetails: initialLocationDetails,
    localizedLocation: { country: "", city: "" },
    isLocationPermissionGranted: false,
    isGettingLocation: false,
    lastKnownCoords: null,
  });
  usePrayerTimesStore.setState({
    didGetCurrentLocation: false,
    hasError: false,
    errorMessage: "",
    yesterdayTimings: null,
    todayTimings: null,
    tomorrowTimings: null,
    twoWeeksTimings: null,
  });
};

describe("prayer-time location fail-safe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
    mockGetPrayerTimesByDateRange.mockResolvedValue([]);
    mockGetPrayerTimesByDate.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not mark location acquired when acquisition fails", async () => {
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(TIMES_FETCH.STORED));
    usePrayerTimesStore.setState({ getAndStorePrayerTimes: refreshPrayerTimes });
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mockGetLocationWithTimeout.mockRejectedValue(new Error("HMS location unavailable"));

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBe(true);

    // Still false, so a real fix is attempted again on the next load.
    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(false);
    expect(useLocationStore.getState().lastKnownCoords).toBeNull();
  });

  /**
   * Declining the permission must not leave the app empty: an app that shows no
   * prayer times without location is both unusable and a store-review risk. The
   * default coordinates (Makkah) stand in until the user sets a location.
   */
  it("falls back to the default location when the permission is declined", async () => {
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(TIMES_FETCH.STORED));
    usePrayerTimesStore.setState({ getAndStorePrayerTimes: refreshPrayerTimes });
    mockCheckLocationPermission.mockResolvedValue({ granted: false, canAskAgain: false });

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBe(true);

    expect(usePrayerTimesStore.getState().hasError).toBe(false);
    expect(refreshPrayerTimes).toHaveBeenCalled();
    // The fix was never verified, so the app keeps trying to acquire a real one.
    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(false);
    expect(useLocationStore.getState().lastKnownCoords).toBeNull();
    // Flagged, so the screen can say the times are not for where the user is.
    expect(usePrayerTimesStore.getState().usingDefaultLocation).toBe(true);
  });

  it("preserves a verified persisted location when a refresh fails", async () => {
    const persistedCoords = {
      ...initialLocationDetails.coords,
      latitude: 24.7136,
      longitude: 46.6753,
      accuracy: 20,
    };
    useLocationStore.setState({
      locationDetails: { ...initialLocationDetails, coords: persistedCoords },
      lastKnownCoords: { latitude: persistedCoords.latitude, longitude: persistedCoords.longitude },
    });
    mockGetLocationWithTimeout.mockRejectedValue(new Error("HMS location unavailable"));

    await expect(useLocationStore.getState().initializeLocation()).rejects.toThrow(
      "HMS location unavailable"
    );

    expect(useLocationStore.getState().locationDetails.coords).toEqual(persistedCoords);
    expect(useLocationStore.getState().lastKnownCoords).toEqual({
      latitude: persistedCoords.latitude,
      longitude: persistedCoords.longitude,
    });
  });

  it("keeps an acquired fix and uses API geocoding when device geocoding rejects", async () => {
    const acquiredLocation = {
      coords: {
        ...initialLocationDetails.coords,
        latitude: 24.7136,
        longitude: 46.6753,
        accuracy: 12,
      },
      timestamp: 1_750_000_000_000,
    };
    mockGetLocationWithTimeout.mockResolvedValue(acquiredLocation);
    mockReverseGeocodeAsync.mockRejectedValue(new Error("Android geocoder unavailable"));
    mockReverseGeocodeApi.mockResolvedValue({
      success: true,
      data: {
        countryName: "Saudi Arabia",
        city: "Riyadh",
        timezone: "Asia/Riyadh",
      },
    });

    await expect(useLocationStore.getState().initializeLocation()).resolves.toBeUndefined();

    expect(useLocationStore.getState().locationDetails).toMatchObject({
      coords: acquiredLocation.coords,
      address: { country: "Saudi Arabia", city: "Riyadh" },
      timezone: "Asia/Riyadh",
      error: null,
    });
    expect(useLocationStore.getState().lastKnownCoords).toEqual({
      latitude: acquiredLocation.coords.latitude,
      longitude: acquiredLocation.coords.longitude,
    });
  });

  it("keeps an acquired fix and uses API geocoding when device geocoding is empty", async () => {
    const acquiredLocation = {
      coords: {
        ...initialLocationDetails.coords,
        latitude: 3.139,
        longitude: 101.6869,
        accuracy: 18,
      },
      timestamp: 1_750_000_000_000,
    };
    mockGetLocationWithTimeout.mockResolvedValue(acquiredLocation);
    mockReverseGeocodeAsync.mockResolvedValue([]);
    mockReverseGeocodeApi.mockResolvedValue({
      success: true,
      data: {
        countryName: "Malaysia",
        city: "Kuala Lumpur",
        timezone: "Asia/Kuala_Lumpur",
      },
    });

    await expect(useLocationStore.getState().initializeLocation()).resolves.toBeUndefined();

    expect(useLocationStore.getState().locationDetails).toMatchObject({
      coords: acquiredLocation.coords,
      address: { country: "Malaysia", city: "Kuala Lumpur" },
      timezone: "Asia/Kuala_Lumpur",
      error: null,
    });
    expect(useLocationStore.getState().lastKnownCoords).toEqual({
      latitude: acquiredLocation.coords.latitude,
      longitude: acquiredLocation.coords.longitude,
    });
  });

  /**
   * The fix itself is good — only its timezone failed to resolve. Loading still
   * proceeds against those coordinates, and `getAndStorePrayerTimes` corrects the
   * zone from the API response, which carries it. The fix stays unverified so a
   * later load retries geocoding.
   */
  it("persists a fresh fix and still loads when its timezone is unresolved", async () => {
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(TIMES_FETCH.STORED));
    const acquiredLocation = {
      coords: {
        ...initialLocationDetails.coords,
        latitude: 51.5072,
        longitude: -0.1276,
        accuracy: 14,
      },
      timestamp: 1_750_000_000_000,
    };
    usePrayerTimesStore.setState({ getAndStorePrayerTimes: refreshPrayerTimes });
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mockGetLocationWithTimeout.mockResolvedValue(acquiredLocation);
    mockReverseGeocodeAsync.mockRejectedValue(new Error("Android geocoder unavailable"));
    mockReverseGeocodeApi.mockRejectedValue(new Error("API geocoder unavailable"));
    jest.spyOn(console, "error").mockImplementation();

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBe(true);

    expect(useLocationStore.getState().locationDetails.coords).toEqual(acquiredLocation.coords);
    expect(useLocationStore.getState().lastKnownCoords).toBeNull();
    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(false);
    expect(refreshPrayerTimes).toHaveBeenCalled();
  });

  it("restores a verified saved location when a new fix has no resolved timezone", async () => {
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(TIMES_FETCH.STORED));
    const savedCoords = {
      ...initialLocationDetails.coords,
      latitude: 51.5072,
      longitude: -0.1276,
      accuracy: 16,
    };
    const savedLocationDetails = {
      ...initialLocationDetails,
      coords: savedCoords,
      address: { country: "United Kingdom", city: "London" },
      timezone: "Europe/London",
    };
    const savedLocalizedLocation = { country: "United Kingdom", city: "London" };
    const acquiredLocation = {
      coords: {
        ...initialLocationDetails.coords,
        latitude: 3.139,
        longitude: 101.6869,
        accuracy: 14,
      },
      timestamp: 1_750_000_000_000,
    };
    usePrayerTimesStore.setState({ getAndStorePrayerTimes: refreshPrayerTimes });
    useLocationStore.setState({
      locationDetails: savedLocationDetails,
      localizedLocation: savedLocalizedLocation,
      lastKnownCoords: { latitude: savedCoords.latitude, longitude: savedCoords.longitude },
    });
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mockGetLocationWithTimeout.mockResolvedValue(acquiredLocation);
    mockReverseGeocodeAsync.mockRejectedValue(new Error("Android geocoder unavailable"));
    mockReverseGeocodeApi.mockRejectedValue(new Error("API geocoder unavailable"));
    jest.spyOn(console, "error").mockImplementation();

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBe(true);

    expect(useLocationStore.getState().locationDetails).toMatchObject({
      coords: savedLocationDetails.coords,
      address: savedLocationDetails.address,
      timezone: savedLocationDetails.timezone,
    });
    expect(useLocationStore.getState().localizedLocation).toEqual(savedLocalizedLocation);
    expect(useLocationStore.getState().lastKnownCoords).toEqual({
      latitude: savedCoords.latitude,
      longitude: savedCoords.longitude,
    });
    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(true);
    expect(refreshPrayerTimes).toHaveBeenCalledTimes(1);
  });

  it("uses verified persisted coordinates when an allowed current refresh fails", async () => {
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(TIMES_FETCH.STORED));
    const persistedCoords = {
      ...initialLocationDetails.coords,
      latitude: 24.7136,
      longitude: 46.6753,
      accuracy: 20,
    };
    usePrayerTimesStore.setState({ getAndStorePrayerTimes: refreshPrayerTimes });
    useLocationStore.setState({
      locationDetails: { ...initialLocationDetails, coords: persistedCoords },
      lastKnownCoords: { latitude: persistedCoords.latitude, longitude: persistedCoords.longitude },
    });
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mockGetLocationWithTimeout.mockRejectedValue(new Error("HMS location unavailable"));

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBe(true);

    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(true);
    expect(useLocationStore.getState().locationDetails.coords).toEqual(persistedCoords);
    expect(refreshPrayerTimes).toHaveBeenCalledTimes(1);
  });

  it("uses a persisted verified location when current permission is unavailable", async () => {
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(TIMES_FETCH.STORED));
    usePrayerTimesStore.setState({ getAndStorePrayerTimes: refreshPrayerTimes });
    useLocationStore.setState({
      locationDetails: {
        ...initialLocationDetails,
        coords: {
          ...initialLocationDetails.coords,
          latitude: 24.7136,
          longitude: 46.6753,
          accuracy: 20,
        },
      },
      lastKnownCoords: { latitude: 24.7136, longitude: 46.6753 },
    });
    mockCheckLocationPermission.mockResolvedValue({ granted: false, canAskAgain: false });

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBe(true);

    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(true);
    expect(refreshPrayerTimes).toHaveBeenCalledTimes(1);
  });
});

const LAHORE: ManualLocation = {
  cityId: 1172451,
  name: "Lahore",
  names: { ar: "لاهور", ur: "لاھور", ms: "Lahore" },
  region: { code: "04", name: "Punjab", names: { ar: "البنجاب", ur: "پنجاب", ms: null } },
  countryCode: "PK",
  country: { name: "Pakistan", names: { ar: "باكستان", ur: "پاکستان", ms: "Pakistan" } },
  latitude: 31.558,
  longitude: 74.35071,
  timezone: "Asia/Karachi",
};
const DEVICE_FIX = {
  coords: { ...initialLocationDetails.coords, latitude: 24.7136, longitude: 46.6753, accuracy: 12 },
  timestamp: 1_750_000_000_000,
};
const RIYADH_GEOCODE = {
  success: true,
  data: { countryName: "Saudi Arabia", city: "Riyadh", timezone: "Asia/Riyadh" },
};
const expectChosenCity = () => {
  const location = useLocationStore.getState();
  expect(location.locationMode).toBe(LocationMode.MANUAL);
  expect(location.lastKnownCoords).toEqual({
    latitude: LAHORE.latitude,
    longitude: LAHORE.longitude,
  });
  expect(location.localizedLocation).toEqual({ country: LAHORE.country.name, city: LAHORE.name });
  expect(location.locationDetails).toMatchObject({
    coords: { latitude: LAHORE.latitude, longitude: LAHORE.longitude },
    address: { country: LAHORE.country.name, city: LAHORE.name },
    timezone: LAHORE.timezone,
    error: null,
  });
};

describe("a device fix that lands after a city was chosen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
    mockReverseGeocodeAsync.mockResolvedValue([]);
    mockReverseGeocodeApi.mockResolvedValue(RIYADH_GEOCODE);
  });

  it("leaves the chosen city when the city comes while the fix is pending", async () => {
    const fix = later<typeof DEVICE_FIX>();
    mockGetLocationWithTimeout.mockReturnValue(fix.promise);
    const reading = useLocationStore.getState().initializeLocation();

    useLocationStore.getState().setManualLocation(LAHORE);
    fix.release(DEVICE_FIX);

    await expect(reading).resolves.toBeUndefined();
    expectChosenCity();
  });

  it("leaves the chosen city when the city comes while the place is looked up", async () => {
    const geocode = later<typeof RIYADH_GEOCODE>();
    mockGetLocationWithTimeout.mockResolvedValue(DEVICE_FIX);
    mockReverseGeocodeApi.mockReturnValue(geocode.promise);
    const reading = useLocationStore.getState().initializeLocation();
    await until(() => mockReverseGeocodeApi.mock.calls.length > 0);
    expect(mockReverseGeocodeApi).toHaveBeenCalled();

    useLocationStore.getState().setManualLocation(LAHORE);
    geocode.release(RIYADH_GEOCODE);

    await expect(reading).resolves.toBeUndefined();
    expectChosenCity();
  });

  it("writes no device error into the chosen city when the fix then fails", async () => {
    const fix = later<typeof DEVICE_FIX>();
    mockGetLocationWithTimeout.mockReturnValue(
      fix.promise.then(() => Promise.reject(new Error("Location request timed out")))
    );
    const reading = useLocationStore.getState().initializeLocation();

    useLocationStore.getState().setManualLocation(LAHORE);
    fix.release(DEVICE_FIX);

    await expect(reading).rejects.toThrow("Location request timed out");
    expectChosenCity();
  });

  it("logs the failure of a fix abandoned for a chosen city as info, not an error", async () => {
    const fix = later<typeof DEVICE_FIX>();
    mockGetLocationWithTimeout.mockReturnValue(
      fix.promise.then(() => Promise.reject(new Error("Location request timed out")))
    );
    const reading = useLocationStore.getState().initializeLocation();

    useLocationStore.getState().setManualLocation(LAHORE);
    fix.release(DEVICE_FIX);

    await expect(reading).rejects.toThrow("Location request timed out");
    expect(locationLog.e).not.toHaveBeenCalled();
    expect(locationLog.i).toHaveBeenCalledWith("Init", expect.stringContaining("abandoned fix"));
  });

  it("logs a failed fix as an error while the place stays automatic", async () => {
    mockGetLocationWithTimeout.mockRejectedValue(new Error("Location request timed out"));

    await expect(useLocationStore.getState().initializeLocation()).rejects.toThrow();

    expect(locationLog.e).toHaveBeenCalledWith(
      "Init",
      "initialize location failed",
      expect.any(Error)
    );
  });

  it("still applies the fix while the place stays automatic", async () => {
    mockGetLocationWithTimeout.mockResolvedValue(DEVICE_FIX);

    await useLocationStore.getState().initializeLocation();

    expect(useLocationStore.getState().lastKnownCoords).toEqual({
      latitude: DEVICE_FIX.coords.latitude,
      longitude: DEVICE_FIX.coords.longitude,
    });
    expect(useLocationStore.getState().localizedLocation.city).toBe("Riyadh");
  });
});

// A try that lost to its deadline leaves its fix running; the place belongs
// to whatever the caller does next, and no load follows the late fix.
describe("a device fix its caller gave up on", () => {
  const SAVED = { latitude: 21.4858, longitude: 39.1925 };
  let wanted = true;

  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
    wanted = true;
    mockReverseGeocodeAsync.mockResolvedValue([]);
    mockReverseGeocodeApi.mockResolvedValue(RIYADH_GEOCODE);
  });

  const expectPlaceKept = (before: LocationStore) => {
    const after = useLocationStore.getState();
    expect(after.locationDetails).toEqual(before.locationDetails);
    expect(after.lastKnownCoords).toEqual(before.lastKnownCoords);
  };

  it("writes no coordinates when it gives up while the fix is pending", async () => {
    const fix = later<typeof DEVICE_FIX>();
    mockGetLocationWithTimeout.mockReturnValue(fix.promise);
    const before = useLocationStore.getState();
    const reading = useLocationStore.getState().initializeLocation(() => wanted);

    wanted = false;
    fix.release(DEVICE_FIX);

    await expect(reading).resolves.toBeUndefined();
    expectPlaceKept(before);
  });

  it("keeps the saved place when it gives up while the place is looked up", async () => {
    useLocationStore.setState((state) => ({
      lastKnownCoords: SAVED,
      locationDetails: {
        ...state.locationDetails,
        coords: { ...state.locationDetails.coords, ...SAVED },
      },
    }));
    const geocode = later<typeof RIYADH_GEOCODE>();
    mockGetLocationWithTimeout.mockResolvedValue(DEVICE_FIX);
    mockReverseGeocodeApi.mockReturnValue(geocode.promise);
    const before = useLocationStore.getState();
    const reading = useLocationStore.getState().initializeLocation(() => wanted);
    await until(() => mockReverseGeocodeApi.mock.calls.length > 0);
    expect(mockReverseGeocodeApi).toHaveBeenCalled();

    wanted = false;
    geocode.release(RIYADH_GEOCODE);

    await expect(reading).resolves.toBeUndefined();
    expectPlaceKept(before);
  });

  it("writes no device error when the fix then fails", async () => {
    const fix = later<typeof DEVICE_FIX>();
    mockGetLocationWithTimeout.mockReturnValue(
      fix.promise.then(() => Promise.reject(new Error("Location request timed out")))
    );
    const reading = useLocationStore.getState().initializeLocation(() => wanted);

    wanted = false;
    fix.release(DEVICE_FIX);

    await expect(reading).rejects.toThrow("Location request timed out");
    expect(useLocationStore.getState().locationDetails.error).toBeNull();
    expect(locationLog.e).not.toHaveBeenCalled();
  });
});

describe("one position read per fetch attempt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
    mockGetPrayerTimesByDateRange.mockResolvedValue([]);
    mockGetPrayerTimesByDate.mockResolvedValue(null);
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mockGetLocationWithTimeout.mockResolvedValue(DEVICE_FIX);
    mockReverseGeocodeAsync.mockResolvedValue([]);
    mockReverseGeocodeApi.mockResolvedValue(RIYADH_GEOCODE);
    usePrayerTimesStore.setState({
      getAndStorePrayerTimes: jest.fn(() => Promise.resolve(TIMES_FETCH.STORED)),
    });
  });

  it("reads the position once when the caller has just applied a fix", async () => {
    await useLocationStore.getState().initializeLocation();
    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true);

    expect(mockGetLocationWithTimeout).toHaveBeenCalledTimes(1);
    expect(mockCheckLocationPermission).not.toHaveBeenCalled();
    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(true);
    expect(usePrayerTimesStore.getState().usingDefaultLocation).toBe(false);
  });

  it("still reads the position itself when no caller holds a fix", async () => {
    await usePrayerTimesStore.getState().loadPrayerTimes(true);

    expect(mockGetLocationWithTimeout).toHaveBeenCalledTimes(1);
    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(true);
  });
});

// The mocked clock's days, as `dateToInt` writes them.
const [YESTERDAY, TODAY, TOMORROW] = [20260718, 20260719, 20260720];
const storedDay = (date: number) => ({ ...RIYADH_DAY, date });

// Stored rows carry no place, so the default place's days pass for any place's.
describe("a place verified after the default place's days were stored", () => {
  /** A fetch the test settles; records the flag held when it starts. */
  const pendingFetch = () => {
    const fetch = later<TimesFetch>();
    const flagAtFetch: boolean[] = [];
    const getAndStorePrayerTimes = jest.fn(() => {
      flagAtFetch.push(usePrayerTimesStore.getState().usingDefaultLocation);
      return fetch.promise;
    });
    usePrayerTimesStore.setState({ getAndStorePrayerTimes });
    return { fetch, flagAtFetch, getAndStorePrayerTimes };
  };
  const usingDefault = () => usePrayerTimesStore.getState().usingDefaultLocation;
  const verifyPlace = () =>
    useLocationStore.setState({
      lastKnownCoords: {
        latitude: DEVICE_FIX.coords.latitude,
        longitude: DEVICE_FIX.coords.longitude,
      },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
    mockGetPrayerTimesByDateRange.mockResolvedValue([storedDay(TODAY), storedDay(TOMORROW)]);
    mockGetPrayerTimesByDate.mockResolvedValue(storedDay(YESTERDAY));
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mockGetLocationWithTimeout.mockResolvedValue(DEVICE_FIX);
    mockReverseGeocodeAsync.mockResolvedValue([]);
    mockReverseGeocodeApi.mockResolvedValue(RIYADH_GEOCODE);
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
  });

  it("refetches at launch, and drops the default flag once the place's days land", async () => {
    const { fetch, flagAtFetch } = pendingFetch();

    const load = usePrayerTimesStore.getState().loadPrayerTimes();
    await until(() => flagAtFetch.length > 0);

    expect(flagAtFetch).toEqual([true]);
    expect(usingDefault()).toBe(true);
    fetch.release(TIMES_FETCH.STORED);
    await load;
    expect(usingDefault()).toBe(false);
  });

  // Best effort, so a launch with no network still runs the rest of its setup.
  it("keeps the default flag and rows, and resolves, when that refetch fails", async () => {
    const { fetch, getAndStorePrayerTimes } = pendingFetch();
    fetch.release(TIMES_FETCH.FAILED);

    await expect(usePrayerTimesStore.getState().loadPrayerTimes()).resolves.toBe(false);

    expect(getAndStorePrayerTimes).toHaveBeenCalled();
    expect(usingDefault()).toBe(true);
    expect(usePrayerTimesStore.getState().todayTimings).toEqual(storedDay(TODAY));
    expect(usePrayerTimesStore.getState().hasError).toBe(false);
    expect(prayerTimesLog.w).toHaveBeenCalledWith("Load", expect.stringContaining("refetch"));
  });

  it("still throws when that refetch fails with a day missing", async () => {
    mockGetPrayerTimesByDate.mockResolvedValue(null);
    const { fetch } = pendingFetch();
    fetch.release(TIMES_FETCH.FAILED);

    await expect(usePrayerTimesStore.getState().loadPrayerTimes()).rejects.toThrow();

    expect(usingDefault()).toBe(true);
    expect(usePrayerTimesStore.getState().hasError).toBe(true);
  });

  it("still throws when a forced refetch fails", async () => {
    const { fetch } = pendingFetch();
    fetch.release(TIMES_FETCH.FAILED);

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).rejects.toThrow();

    expect(usingDefault()).toBe(true);
  });

  it("refetches the same way for a place the location store already holds", async () => {
    verifyPlace();
    const { fetch, flagAtFetch } = pendingFetch();

    const load = usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();
    await until(() => flagAtFetch.length > 0);

    expect(flagAtFetch).toEqual([true]);
    fetch.release(TIMES_FETCH.STORED);
    await load;
    expect(usingDefault()).toBe(false);
  });

  it("does not refetch a verified place whose days are all stored", async () => {
    verifyPlace();
    usePrayerTimesStore.setState({ usingDefaultLocation: false, didGetCurrentLocation: true });
    const { getAndStorePrayerTimes } = pendingFetch();

    await usePrayerTimesStore.getState().loadPrayerTimes();

    expect(getAndStorePrayerTimes).not.toHaveBeenCalled();
    expect(usingDefault()).toBe(false);
  });

  it("does not refetch the default place's stored days while no fix lands", async () => {
    mockCheckLocationPermission.mockResolvedValue({ granted: false, canAskAgain: false });
    const { getAndStorePrayerTimes } = pendingFetch();

    await usePrayerTimesStore.getState().loadPrayerTimes();

    expect(getAndStorePrayerTimes).not.toHaveBeenCalled();
    expect(usingDefault()).toBe(true);
  });
});

// A kill while the timezone is looked up keeps what reached disk.
describe("a device fix over a verified saved place", () => {
  const SAVED_COORDS = {
    ...initialLocationDetails.coords,
    latitude: 51.5072,
    longitude: -0.1276,
    accuracy: 16,
  };
  const SAVED_PLACE = {
    locationDetails: {
      ...initialLocationDetails,
      coords: SAVED_COORDS,
      address: { country: "United Kingdom", city: "London" },
      timezone: "Europe/London",
    },
    localizedLocation: { country: "United Kingdom", city: "London" },
    lastKnownCoords: { latitude: SAVED_COORDS.latitude, longitude: SAVED_COORDS.longitude },
  };
  const FIX_COORDS = {
    latitude: DEVICE_FIX.coords.latitude,
    longitude: DEVICE_FIX.coords.longitude,
  };

  /** The location store's last write to disk. */
  const onDisk = () => {
    const { name } = useLocationStore.persist.getOptions();
    const writes = jest.mocked(Storage.setItem).mock.calls.filter(([key]) => key === name);
    return JSON.parse(String(writes.at(-1)?.[1])).state;
  };
  const expectSavedPlace = (state: Partial<LocationStore>) =>
    expect(state).toMatchObject({
      lastKnownCoords: SAVED_PLACE.lastKnownCoords,
      localizedLocation: SAVED_PLACE.localizedLocation,
      locationDetails: {
        coords: SAVED_COORDS,
        address: SAVED_PLACE.locationDetails.address,
        timezone: SAVED_PLACE.locationDetails.timezone,
      },
    });

  /** Starts a fix whose timezone lookup the test settles. */
  const startLookup = async () => {
    const lookup = later<typeof RIYADH_GEOCODE>();
    mockReverseGeocodeApi.mockReturnValue(lookup.promise);
    const reading = useLocationStore.getState().initializeLocation();
    await until(() => mockReverseGeocodeApi.mock.calls.length > 0);
    expect(mockReverseGeocodeApi).toHaveBeenCalled();
    return { lookup, reading };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
    useLocationStore.setState(SAVED_PLACE);
    mockGetLocationWithTimeout.mockResolvedValue(DEVICE_FIX);
    mockReverseGeocodeAsync.mockResolvedValue([]);
    jest.spyOn(console, "error").mockImplementation();
  });

  it("keeps the saved place, in memory and on disk, while the timezone is looked up", async () => {
    const { lookup, reading } = await startLookup();

    expectSavedPlace(useLocationStore.getState());
    expectSavedPlace(onDisk());

    lookup.release(RIYADH_GEOCODE);
    await reading;
  });

  it("writes the new place once its timezone resolves", async () => {
    const { lookup, reading } = await startLookup();

    lookup.release(RIYADH_GEOCODE);
    await expect(reading).resolves.toBeUndefined();

    const location = useLocationStore.getState();
    expect(location.lastKnownCoords).toEqual(FIX_COORDS);
    expect(location.localizedLocation.city).toBe(RIYADH_GEOCODE.data.city);
    expect(location.locationDetails).toMatchObject({
      coords: DEVICE_FIX.coords,
      timezone: RIYADH_GEOCODE.data.timezone,
    });
    expect(onDisk().lastKnownCoords).toEqual(FIX_COORDS);
  });

  it("keeps the saved place when the timezone does not resolve", async () => {
    const { lookup, reading } = await startLookup();

    lookup.fail(new Error("API geocoder unavailable"));
    await expect(reading).rejects.toThrow();

    expectSavedPlace(useLocationStore.getState());
    expectSavedPlace(onDisk());
  });
});
