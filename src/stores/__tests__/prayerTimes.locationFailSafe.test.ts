import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { initialLocationDetails } from "@/types/location";

const mockGetLocationWithTimeout = jest.fn();
const mockCheckLocationPermission = jest.fn();
const mockGetPrayerTimesByDateRange = jest.fn();
const mockGetPrayerTimesByDate = jest.fn();
const mockReverseGeocodeAsync = jest.fn();
const mockReverseGeocodeApi = jest.fn();

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
  useAppStore: {
    getState: () => ({ setLoadingState: jest.fn() }),
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

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));

jest.mock("@/utils/date", () => ({
  dateToInt: (date: Date) => Number(date.toISOString().slice(0, 10).replaceAll("-", "")),
  getTimezoneMonth: () => 7,
  getTimezoneYear: () => 2026,
  timeZonedNow: () => new Date("2026-07-19T12:00:00.000Z"),
}));

jest.mock("../../../modules/expo-widget/src", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("../../../modules/expo-widgets/src", () => ({ refreshAllWidgets: jest.fn() }));

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

  it("does not mark location acquired or refresh prayer times after acquisition fails", async () => {
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(true));
    usePrayerTimesStore.setState({ getAndStorePrayerTimes: refreshPrayerTimes });
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canRequestAgain: true });
    mockGetLocationWithTimeout.mockRejectedValue(new Error("HMS location unavailable"));

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).rejects.toThrow(
      "HMS location unavailable"
    );

    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(false);
    expect(useLocationStore.getState().lastKnownCoords).toBeNull();
    expect(refreshPrayerTimes).not.toHaveBeenCalled();
  });

  it("does not refresh prayer times from the unverified default Mecca coordinates", async () => {
    const refreshPrayerTimes = jest.fn(() => Promise.resolve(true));
    usePrayerTimesStore.setState({ getAndStorePrayerTimes: refreshPrayerTimes });
    mockCheckLocationPermission.mockResolvedValue({ granted: false, canRequestAgain: false });

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).rejects.toThrow();

    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(false);
    expect(refreshPrayerTimes).not.toHaveBeenCalled();
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

  it("persists a fresh fix but blocks prayer loading when its timezone is unresolved", async () => {
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

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).rejects.toThrow();

    expect(useLocationStore.getState().locationDetails.coords).toEqual(acquiredLocation.coords);
    expect(useLocationStore.getState().lastKnownCoords).toBeNull();
    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(false);
    expect(refreshPrayerTimes).not.toHaveBeenCalled();
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
