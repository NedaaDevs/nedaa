import { reverseGeocodeAsync } from "@/adapters/location";
import { FIX_SOURCE, LOCATION_FAILURE } from "@/constants/Location";
import { LocationMode } from "@/enums/location";
import { useLocationStore, type LocationStore } from "@/stores/location";
import { initialLocationDetails, type LocationObject } from "@/types/location";
import { LocationFixError, getLocationWithTimeout, readLocation } from "@/utils/location";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/adapters/location", () => ({
  reverseGeocodeAsync: jest.fn(),
}));

jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  readLocation: jest.fn(),
  getLocationWithTimeout: jest.fn(),
}));

jest.mock("@/utils/appLogger", () => {
  const log = { d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() };
  return { AppLogger: { create: () => log } };
});

const mockReadLocation = readLocation as jest.Mock;
const mockGetLocationWithTimeout = getLocationWithTimeout as jest.Mock;
const mockReverseGeocodeAsync = reverseGeocodeAsync as jest.Mock;

const fixAt = (latitude: number, longitude: number): LocationObject => ({
  coords: {
    latitude,
    longitude,
    altitude: null,
    accuracy: 100,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 1_750_000_000_000,
});

const RIYADH = fixAt(24.7136, 46.6753);
const JEDDAH = fixAt(21.4858, 39.1925);
// About 30 km from JEDDAH: past the city-change distance, inside the same city.
const JEDDAH_NORTH = fixAt(21.76, 39.15);

const deviceAddress = (city: string) => ({ city, country: "Saudi Arabia", timezone: null });

const reverseGeocode: LocationStore["reverseGeocode"] = jest.fn(async () => ({
  city: "Riyadh",
  countryName: "Saudi Arabia",
  timezone: "Asia/Riyadh",
}));

describe("device fix in the location store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationStore.setState({
      locationMode: LocationMode.DEVICE,
      manualLocation: null,
      locationDetails: {
        ...initialLocationDetails,
        coords: RIYADH.coords,
        address: { country: "Saudi Arabia", city: "Riyadh" },
      },
      lastKnownCoords: { latitude: RIYADH.coords.latitude, longitude: RIYADH.coords.longitude },
      showCityChangeModal: false,
      pendingCityChange: null,
      reverseGeocode,
    });
  });

  it("stores the failure kind of a failed first fix", async () => {
    mockReadLocation.mockRejectedValue(new LocationFixError(LOCATION_FAILURE.TIMEOUT));

    await expect(useLocationStore.getState().initializeLocation()).rejects.toThrow();

    expect(useLocationStore.getState().locationDetails.error).toBe(LOCATION_FAILURE.TIMEOUT);
  });

  it("stores the failure kind of a failed update", async () => {
    mockReadLocation.mockRejectedValue(new LocationFixError(LOCATION_FAILURE.SERVICES_OFF));

    await expect(useLocationStore.getState().updateCurrentLocation()).rejects.toThrow();

    expect(useLocationStore.getState().locationDetails.error).toBe(LOCATION_FAILURE.SERVICES_OFF);
  });

  it("records the source of the first fix", async () => {
    mockReadLocation.mockResolvedValue({ location: RIYADH, source: FIX_SOURCE.LAST_KNOWN });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Riyadh")]);

    await useLocationStore.getState().initializeLocation();

    expect(useLocationStore.getState().locationDetails.fixSource).toBe(FIX_SOURCE.LAST_KNOWN);
  });

  it("records the source of an updated fix", async () => {
    mockReadLocation.mockResolvedValue({ location: JEDDAH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);

    await useLocationStore.getState().updateCurrentLocation();

    expect(useLocationStore.getState().locationDetails.fixSource).toBe(FIX_SOURCE.FRESH);
  });

  it("names the updated fix's city in the stored address", async () => {
    mockReadLocation.mockResolvedValue({ location: JEDDAH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);

    await useLocationStore.getState().updateCurrentLocation();

    expect(useLocationStore.getState().locationDetails.address?.city).toBe("Jeddah");
  });

  it("prompts for no city change inside the city an update moved to", async () => {
    mockReadLocation.mockResolvedValue({ location: JEDDAH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);
    await useLocationStore.getState().updateCurrentLocation();

    mockGetLocationWithTimeout.mockResolvedValue(JEDDAH_NORTH);
    await useLocationStore.getState().checkAndPromptCityChange();

    expect(useLocationStore.getState().pendingCityChange).toBeNull();
  });

  it("skips the city-change prompt quietly when the geocoder names nothing", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockGetLocationWithTimeout.mockResolvedValue(JEDDAH);
    mockReverseGeocodeAsync.mockResolvedValue([]);

    await useLocationStore.getState().checkAndPromptCityChange();

    expect(useLocationStore.getState().pendingCityChange).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("drops a saved error that is not a failure kind", () => {
    const merge = useLocationStore.persist.getOptions().merge!;
    const saved = {
      locationDetails: { ...initialLocationDetails, error: "Location request timed out" },
    };

    const merged = merge(saved, useLocationStore.getState()) as LocationStore;

    expect(merged.locationDetails.error).toBeNull();
  });

  it("keeps a saved failure kind", () => {
    const merge = useLocationStore.persist.getOptions().merge!;
    const saved = {
      locationDetails: { ...initialLocationDetails, error: LOCATION_FAILURE.TIMEOUT },
    };

    const merged = merge(saved, useLocationStore.getState()) as LocationStore;

    expect(merged.locationDetails.error).toBe(LOCATION_FAILURE.TIMEOUT);
  });
});
