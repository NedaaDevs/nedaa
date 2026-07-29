import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { initialLocationDetails, type ManualLocation } from "@/types/location";
import { LocationMode } from "@/enums/location";

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
  default: { getState: () => ({ locale: "en" }) },
  useAppStore: { getState: () => ({ setLoadingState: jest.fn() }) },
}));

jest.mock("@/stores/providerSettings", () => ({
  __esModule: true,
  default: { getState: () => ({ currentProviderId: "aladhan" }) },
}));

jest.mock("@/api/geocodeApi", () => ({
  geocodeApi: { reverseGeocode: (...args: unknown[]) => mockReverseGeocodeApi(...args) },
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

jest.mock("@/adapters/providers", () => ({ getAdapterByProviderId: jest.fn() }));

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

const LAHORE: ManualLocation = {
  cityId: 1172451,
  name: "Lahore",
  names: { ar: "لاهور", ur: "لاھور", ms: null },
  region: null,
  countryCode: "PK",
  country: { name: "Pakistan", names: { ar: "باكستان", ur: null, ms: null } },
  latitude: 31.558,
  longitude: 74.35071,
  timezone: "Asia/Karachi",
};

describe("prayer times with a manual location", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationStore.setState({
      locationDetails: initialLocationDetails,
      localizedLocation: { country: "", city: "" },
      lastKnownCoords: null,
      locationMode: LocationMode.DEVICE,
      manualLocation: null,
    });
    usePrayerTimesStore.setState({
      didGetCurrentLocation: false,
      hasError: false,
      errorMessage: "",
      usingDefaultLocation: false,
    });
    mockGetPrayerTimesByDateRange.mockResolvedValue([]);
    mockGetPrayerTimesByDate.mockResolvedValue(null);
    usePrayerTimesStore.setState({ getAndStorePrayerTimes: jest.fn(() => Promise.resolve(true)) });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("never touches the location permission or the device position in manual mode", async () => {
    useLocationStore.getState().setManualLocation(LAHORE);

    await expect(usePrayerTimesStore.getState().loadPrayerTimes(true)).resolves.toBeUndefined();

    expect(mockCheckLocationPermission).not.toHaveBeenCalled();
    expect(mockGetLocationWithTimeout).not.toHaveBeenCalled();
  });

  it("treats manual coordinates as a real position, so no default-location warning shows", async () => {
    useLocationStore.getState().setManualLocation(LAHORE);

    await usePrayerTimesStore.getState().loadPrayerTimes(true);

    expect(usePrayerTimesStore.getState().usingDefaultLocation).toBe(false);
    expect(usePrayerTimesStore.getState().didGetCurrentLocation).toBe(true);
  });

  it("computes against the chosen city's timezone", async () => {
    useLocationStore.getState().setManualLocation(LAHORE);

    await usePrayerTimesStore.getState().loadPrayerTimes(true);

    expect(useLocationStore.getState().locationDetails.timezone).toBe("Asia/Karachi");
  });

  it("still acquires the device position in device mode", async () => {
    mockCheckLocationPermission.mockResolvedValue({ granted: true, canRequestAgain: true });
    mockGetLocationWithTimeout.mockRejectedValue(new Error("no fix"));

    await usePrayerTimesStore.getState().loadPrayerTimes(true);

    expect(mockCheckLocationPermission).toHaveBeenCalled();
  });

  it("resumes device acquisition once the manual location is cleared", async () => {
    useLocationStore.getState().setManualLocation(LAHORE);
    useLocationStore.getState().clearManualLocation();
    usePrayerTimesStore.setState({ didGetCurrentLocation: false });
    mockCheckLocationPermission.mockResolvedValue({ granted: false, canRequestAgain: true });

    await usePrayerTimesStore.getState().loadPrayerTimes(true);

    expect(mockCheckLocationPermission).toHaveBeenCalled();
  });
});

describe("city-change prompting with a manual location", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationStore.setState({
      locationDetails: initialLocationDetails,
      lastKnownCoords: { latitude: 31.558, longitude: 74.35071 },
      locationMode: LocationMode.MANUAL,
      manualLocation: LAHORE,
      showCityChangeModal: false,
      pendingCityChange: null,
    });
  });

  it("does not read the device position to second-guess a chosen city", async () => {
    await useLocationStore.getState().checkAndPromptCityChange();

    expect(mockGetLocationWithTimeout).not.toHaveBeenCalled();
    expect(useLocationStore.getState().showCityChangeModal).toBe(false);
  });
});
