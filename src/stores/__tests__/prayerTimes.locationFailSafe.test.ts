import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { initialLocationDetails } from "@/types/location";
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

jest.mock("@/utils/location", () => ({
  CITY_CHANGE_THRESHOLD: 10,
  calculateDistance: jest.fn(),
  checkLocationPermission: (...args: unknown[]) => mockCheckLocationPermission(...args),
  getLocationWithTimeout: (...args: unknown[]) => mockGetLocationWithTimeout(...args),
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

const prayerTimesLog = AppLogger.create("prayertimes");

const resetStores = () => {
  useLocationStore.setState({
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
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(true));
    usePrayerTimesStore.setState({ getAndStorePrayerTimes: refreshPrayerTimes });
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canRequestAgain: true });
    mockGetLocationWithTimeout.mockRejectedValue(new Error("HMS location unavailable"));

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBeUndefined();

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
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(true));
    usePrayerTimesStore.setState({ getAndStorePrayerTimes: refreshPrayerTimes });
    mockCheckLocationPermission.mockResolvedValue({ granted: false, canRequestAgain: false });

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBeUndefined();

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
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(true));
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
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canRequestAgain: true });
    mockGetLocationWithTimeout.mockResolvedValue(acquiredLocation);
    mockReverseGeocodeAsync.mockRejectedValue(new Error("Android geocoder unavailable"));
    mockReverseGeocodeApi.mockRejectedValue(new Error("API geocoder unavailable"));
    jest.spyOn(console, "error").mockImplementation();

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBeUndefined();

    expect(useLocationStore.getState().locationDetails.coords).toEqual(acquiredLocation.coords);
    expect(useLocationStore.getState().lastKnownCoords).toBeNull();
    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(false);
    expect(refreshPrayerTimes).toHaveBeenCalled();
  });

  it("restores a verified saved location when a new fix has no resolved timezone", async () => {
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(true));
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
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canRequestAgain: true });
    mockGetLocationWithTimeout.mockResolvedValue(acquiredLocation);
    mockReverseGeocodeAsync.mockRejectedValue(new Error("Android geocoder unavailable"));
    mockReverseGeocodeApi.mockRejectedValue(new Error("API geocoder unavailable"));
    jest.spyOn(console, "error").mockImplementation();

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBeUndefined();

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
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(true));
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
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canRequestAgain: true });
    mockGetLocationWithTimeout.mockRejectedValue(new Error("HMS location unavailable"));

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBeUndefined();

    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(true);
    expect(useLocationStore.getState().locationDetails.coords).toEqual(persistedCoords);
    expect(refreshPrayerTimes).toHaveBeenCalledTimes(1);
  });

  it("uses a persisted verified location when current permission is unavailable", async () => {
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(true));
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
    mockCheckLocationPermission.mockResolvedValue({ granted: false, canRequestAgain: false });

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBeUndefined();

    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(true);
    expect(refreshPrayerTimes).toHaveBeenCalledTimes(1);
  });
});

const DEVICE_FIX = {
  coords: { ...initialLocationDetails.coords, latitude: 24.7136, longitude: 46.6753, accuracy: 12 },
  timestamp: 1_750_000_000_000,
};
const RIYADH_GEOCODE = {
  success: true,
  data: { countryName: "Saudi Arabia", city: "Riyadh", timezone: "Asia/Riyadh" },
};

// The mocked clock's days, as `dateToInt` writes them.
const [YESTERDAY, TODAY, TOMORROW] = [20260718, 20260719, 20260720];
const storedDay = (date: number) => ({ ...RIYADH_DAY, date });

// Stored rows carry no place, so the default place's days pass for any place's.
describe("a place verified after the default place's days were stored", () => {
  /** A fetch the test settles; records the flag held when it starts. */
  const pendingFetch = () => {
    const fetch = later<boolean>();
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
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canRequestAgain: true });
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
    fetch.release(true);
    await load;
    expect(usingDefault()).toBe(false);
  });

  // Best effort, so a launch with no network still runs the rest of its setup.
  it("keeps the default flag and rows, and resolves, when that refetch fails", async () => {
    const { fetch, getAndStorePrayerTimes } = pendingFetch();
    fetch.release(false);

    await expect(usePrayerTimesStore.getState().loadPrayerTimes()).resolves.toBeUndefined();

    expect(getAndStorePrayerTimes).toHaveBeenCalled();
    expect(usingDefault()).toBe(true);
    expect(usePrayerTimesStore.getState().todayTimings).toEqual(storedDay(TODAY));
    expect(usePrayerTimesStore.getState().hasError).toBe(false);
    expect(prayerTimesLog.w).toHaveBeenCalledWith("Load", expect.stringContaining("refetch"));
  });

  it("still throws when that refetch fails with a day missing", async () => {
    mockGetPrayerTimesByDate.mockResolvedValue(null);
    const { fetch } = pendingFetch();
    fetch.release(false);

    await expect(usePrayerTimesStore.getState().loadPrayerTimes()).rejects.toThrow();

    expect(usingDefault()).toBe(true);
    expect(usePrayerTimesStore.getState().hasError).toBe(true);
  });

  it("still throws when a forced refetch fails", async () => {
    const { fetch } = pendingFetch();
    fetch.release(false);

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).rejects.toThrow();

    expect(usingDefault()).toBe(true);
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
    mockCheckLocationPermission.mockResolvedValue({ granted: false, canRequestAgain: false });
    const { getAndStorePrayerTimes } = pendingFetch();

    await usePrayerTimesStore.getState().loadPrayerTimes();

    expect(getAndStorePrayerTimes).not.toHaveBeenCalled();
    expect(usingDefault()).toBe(true);
  });
});
