import { renderHook } from "@testing-library/react-native";

import { reverseGeocodeAsync } from "@/adapters/location";
import { FIX_SOURCE, LOCATION_FAILURE, PLACE_UNKNOWN, knownPlaceName } from "@/constants/Location";
import { LocationMode } from "@/enums/location";
import { usePlace } from "@/hooks/usePlace";
import { useAppStore } from "@/stores/app";
import { useLocationStore, type LocationStore } from "@/stores/location";
import { initialLocationDetails, type LocationObject, type ManualLocation } from "@/types/location";
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

const MAKKAH_CITY: ManualLocation = {
  cityId: 104515,
  name: "Makkah",
  names: { ar: "مكة المكرمة", ur: null, ms: null },
  region: null,
  countryCode: "SA",
  country: { name: "Saudi Arabia", names: { ar: "السعودية", ur: null, ms: null } },
  latitude: 21.4225,
  longitude: 39.8262,
  timezone: "Asia/Riyadh",
};

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
      cityOffered: null,
      reverseGeocode,
    });
    useAppStore.setState({ isFirstRun: false });
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

  // A move drops the old translated name; the new one's lands later.
  it("names a new city at once, before its translation lands", async () => {
    useLocationStore.setState({
      localizedLocation: { city: "الرياض", country: "السعودية" },
      reverseGeocode: () => new Promise(() => {}),
    });
    mockReadLocation.mockResolvedValue({ location: JEDDAH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);

    await useLocationStore.getState().updateCurrentLocation();

    expect(useLocationStore.getState().localizedLocation).toEqual({
      city: "Jeddah",
      country: "Saudi Arabia",
    });
  });

  it("keeps the translated name of a refresh in the same city", async () => {
    const localized = { city: "الرياض", country: "السعودية" };
    useLocationStore.setState({
      localizedLocation: localized,
      reverseGeocode: () => new Promise(() => {}),
    });
    mockReadLocation.mockResolvedValue({ location: RIYADH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Riyadh")]);

    await useLocationStore.getState().updateCurrentLocation();

    expect(useLocationStore.getState().localizedLocation).toEqual(localized);
  });

  // Naming the place needs the network; an offline refresh is not a move.
  describe("a refresh whose device geocoder fails", () => {
    const localized = { city: "الرياض", country: "السعودية" };

    beforeEach(() => {
      useLocationStore.setState({
        localizedLocation: localized,
        reverseGeocode: jest.fn(async () => {
          throw new Error("offline");
        }),
      });
      mockReadLocation.mockResolvedValue({ location: RIYADH, source: FIX_SOURCE.FRESH });
      mockReverseGeocodeAsync.mockRejectedValue(new Error("offline"));
    });

    it("keeps the saved name, and the place still shows it", async () => {
      await useLocationStore.getState().updateCurrentLocation();

      const state = useLocationStore.getState();
      expect(state.locationDetails.address).toEqual({ country: "Saudi Arabia", city: "Riyadh" });
      expect(state.localizedLocation).toEqual(localized);
      const { result } = await renderHook(() => usePlace());
      expect(result.current.city).toBe(localized.city);
    });

    it("clears the saved name when the fix is in another city", async () => {
      mockReadLocation.mockResolvedValue({ location: JEDDAH, source: FIX_SOURCE.FRESH });

      await useLocationStore.getState().updateCurrentLocation();

      expect(
        knownPlaceName(useLocationStore.getState().locationDetails.address?.city)
      ).toBeUndefined();
      const { result } = await renderHook(() => usePlace());
      expect(result.current.city).toBeUndefined();
    });

    it("still offers a city change once the device moves", async () => {
      await useLocationStore.getState().updateCurrentLocation();
      mockGetLocationWithTimeout.mockResolvedValue(JEDDAH);
      mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);

      await useLocationStore.getState().checkAndPromptCityChange();

      expect(useLocationStore.getState().pendingCityChange).toEqual({
        currentCity: "Riyadh",
        newCity: "Jeddah",
      });
    });

    // A chosen city's name was never the device geocoder's.
    it("leaves the device's place unnamed when it replaces a chosen city", async () => {
      useLocationStore.getState().setManualLocation(MAKKAH_CITY);
      mockReadLocation.mockResolvedValue({ location: JEDDAH, source: FIX_SOURCE.FRESH });

      await useLocationStore.getState().adoptDeviceLocation();

      const state = useLocationStore.getState();
      expect(state.locationMode).toBe(LocationMode.DEVICE);
      expect(knownPlaceName(state.locationDetails.address?.city)).toBeUndefined();
      expect(state.localizedLocation.city).toBe("");
    });

    it("leaves the place unnamed after a chosen city is cleared", async () => {
      useLocationStore.getState().setManualLocation(MAKKAH_CITY);
      useLocationStore.getState().clearManualLocation();
      const atMakkah = fixAt(MAKKAH_CITY.latitude, MAKKAH_CITY.longitude);
      mockReadLocation.mockResolvedValue({ location: atMakkah, source: FIX_SOURCE.FRESH });

      await useLocationStore.getState().updateCurrentLocation();

      expect(
        knownPlaceName(useLocationStore.getState().locationDetails.address?.city)
      ).toBeUndefined();
    });
  });

  // An old name would hide a move the geocoder could not name.
  it.each([
    ["no address", []],
    ["an address without a city", [{ city: null, country: "Saudi Arabia", timezone: null }]],
  ])("clears the saved name when the geocoder answers with %s", async (_case, answer) => {
    useLocationStore.setState({
      localizedLocation: { city: "الرياض", country: "السعودية" },
      reverseGeocode: () => new Promise(() => {}),
    });
    mockReadLocation.mockResolvedValue({ location: RIYADH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue(answer);

    await useLocationStore.getState().updateCurrentLocation();

    expect(
      knownPlaceName(useLocationStore.getState().locationDetails.address?.city)
    ).toBeUndefined();
    const { result } = await renderHook(() => usePlace());
    expect(result.current.city).toBeUndefined();
  });

  it("takes a zone as the place's own", async () => {
    await useLocationStore.getState().setTimezone("Asia/Dubai");

    expect(useLocationStore.getState().locationDetails.timezone).toBe("Asia/Dubai");
  });

  describe("the city-change offer", () => {
    /** The device now reads Jeddah, named by the device geocoder. */
    const inJeddah = () => {
      mockGetLocationWithTimeout.mockResolvedValue(JEDDAH);
      mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);
    };

    it("offers the new city against the saved one", async () => {
      inJeddah();

      await useLocationStore.getState().checkAndPromptCityChange();

      const state = useLocationStore.getState();
      expect(state.pendingCityChange).toEqual({ currentCity: "Riyadh", newCity: "Jeddah" });
      expect(state.showCityChangeModal).toBe(true);
    });

    it("logs through the app logger, not the console", async () => {
      const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
      inJeddah();

      await useLocationStore.getState().checkAndPromptCityChange();

      expect(consoleLog).not.toHaveBeenCalled();
      consoleLog.mockRestore();
    });

    it("offers nothing while onboarding runs", async () => {
      useAppStore.setState({ isFirstRun: true });
      inJeddah();

      await useLocationStore.getState().checkAndPromptCityChange();

      expect(useLocationStore.getState().pendingCityChange).toBeNull();
    });

    it.each([
      ["no saved address", null],
      ["an unnamed saved city", { country: "Saudi Arabia", city: PLACE_UNKNOWN }],
    ])("offers nothing against %s", async (_case, address) => {
      useLocationStore.setState((state) => ({
        locationDetails: { ...state.locationDetails, address },
      }));
      inJeddah();

      await useLocationStore.getState().checkAndPromptCityChange();

      expect(useLocationStore.getState().pendingCityChange).toBeNull();
    });

    it("offers nothing for a new place the geocoder cannot name", async () => {
      mockGetLocationWithTimeout.mockResolvedValue(JEDDAH);
      mockReverseGeocodeAsync.mockResolvedValue([deviceAddress(PLACE_UNKNOWN)]);

      await useLocationStore.getState().checkAndPromptCityChange();

      expect(useLocationStore.getState().pendingCityChange).toBeNull();
    });

    // Saved coordinates that moved during the read are not the ones compared.
    it("offers nothing when the saved place moved during the check", async () => {
      mockGetLocationWithTimeout.mockImplementation(async () => {
        useLocationStore.getState().setManualLocation(MAKKAH_CITY);
        useLocationStore.setState({ locationMode: LocationMode.DEVICE });
        return JEDDAH;
      });
      mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);

      await useLocationStore.getState().checkAndPromptCityChange();

      expect(useLocationStore.getState().pendingCityChange).toBeNull();
    });

    it("keeps the offer drawn while the sheet closes", async () => {
      inJeddah();
      await useLocationStore.getState().checkAndPromptCityChange();

      useLocationStore.getState().closeCityChange();

      const state = useLocationStore.getState();
      expect(state.showCityChangeModal).toBe(false);
      expect(state.pendingCityChange).toEqual({ currentCity: "Riyadh", newCity: "Jeddah" });
    });

    it("offers a closed city no more this session, and offers another", async () => {
      inJeddah();
      await useLocationStore.getState().checkAndPromptCityChange();
      useLocationStore.getState().clearCityChange();

      await useLocationStore.getState().checkAndPromptCityChange();
      expect(useLocationStore.getState().pendingCityChange).toBeNull();

      mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Taif")]);
      await useLocationStore.getState().checkAndPromptCityChange();
      expect(useLocationStore.getState().pendingCityChange?.newCity).toBe("Taif");
    });
  });

  it("records when the first fix was observed", async () => {
    mockReadLocation.mockResolvedValue({ location: RIYADH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Riyadh")]);

    await useLocationStore.getState().initializeLocation();

    expect(useLocationStore.getState().locationDetails.fixedAt).toBe(RIYADH.timestamp);
  });

  it("records when an updated fix was observed, which a cached fix dates earlier", async () => {
    const cached = { ...JEDDAH, timestamp: JEDDAH.timestamp - 60_000 };
    mockReadLocation.mockResolvedValue({ location: cached, source: FIX_SOURCE.LAST_KNOWN });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);

    await useLocationStore.getState().updateCurrentLocation();

    expect(useLocationStore.getState().locationDetails.fixedAt).toBe(cached.timestamp);
  });

  it("keeps no fix time for a chosen city", () => {
    useLocationStore.setState({
      locationDetails: { ...initialLocationDetails, fixedAt: RIYADH.timestamp },
    });

    useLocationStore.getState().setManualLocation(MAKKAH_CITY);

    expect(useLocationStore.getState().locationDetails.fixedAt).toBeNull();
  });

  // A read stalls for seconds; a city chosen meanwhile is the user's.
  describe("a city chosen while a device read runs", () => {
    /** A read that resolves only once `finish` is called. */
    const heldRead = () => {
      let finish: (fix: LocationObject) => void = () => {};
      mockReadLocation.mockReturnValue(
        new Promise((resolve) => {
          finish = (location) => resolve({ location, source: FIX_SOURCE.FRESH });
        })
      );
      mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);
      return (location: LocationObject) => finish(location);
    };
    const MAKKAH_COORDS = { latitude: MAKKAH_CITY.latitude, longitude: MAKKAH_CITY.longitude };

    it("keeps the city over a refresh that lands after it", async () => {
      const finish = heldRead();
      const update = useLocationStore.getState().updateCurrentLocation();

      useLocationStore.getState().setManualLocation(MAKKAH_CITY);
      finish(JEDDAH);
      await update;

      const state = useLocationStore.getState();
      expect(state.locationMode).toBe(LocationMode.MANUAL);
      expect(state.locationDetails.coords.latitude).toBe(MAKKAH_CITY.latitude);
      expect(state.lastKnownCoords).toEqual(MAKKAH_COORDS);
    });

    it("stores no failure for a read that fails after the city was chosen", async () => {
      let fail: (error: Error) => void = () => {};
      mockReadLocation.mockReturnValue(new Promise((_resolve, reject) => (fail = reject)));
      const update = useLocationStore.getState().updateCurrentLocation();

      useLocationStore.getState().setManualLocation(MAKKAH_CITY);
      fail(new LocationFixError(LOCATION_FAILURE.TIMEOUT));

      await expect(update).resolves.toBeUndefined();
      expect(useLocationStore.getState().locationDetails.error).toBeNull();
    });

    it("keeps a city chosen while the switch to the device reads", async () => {
      const OTHER = { ...MAKKAH_CITY, cityId: 1, name: "Taif", latitude: 21.27, longitude: 40.41 };
      useLocationStore.getState().setManualLocation(MAKKAH_CITY);
      const finish = heldRead();
      const adopt = useLocationStore.getState().adoptDeviceLocation();

      useLocationStore.getState().setManualLocation(OTHER);
      finish(JEDDAH);
      await adopt;

      const state = useLocationStore.getState();
      expect(state.locationMode).toBe(LocationMode.MANUAL);
      expect(state.manualLocation).toEqual(OTHER);
      expect(state.lastKnownCoords).toEqual({
        latitude: OTHER.latitude,
        longitude: OTHER.longitude,
      });
    });
  });

  // Naming the place needs the network; the device itself found it.
  it("stores no failure kind when the read worked and the timezone did not", async () => {
    useLocationStore.setState((state) => ({
      locationDetails: { ...state.locationDetails, error: LOCATION_FAILURE.TIMEOUT },
      reverseGeocode: jest.fn(async () => {
        throw new Error("offline");
      }),
    }));
    mockReadLocation.mockResolvedValue({ location: RIYADH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Riyadh")]);

    await expect(useLocationStore.getState().initializeLocation()).rejects.toThrow();

    expect(useLocationStore.getState().locationDetails.error).toBeNull();
  });

  describe("adopting the device location over a chosen city", () => {
    beforeEach(() => useLocationStore.getState().setManualLocation(MAKKAH_CITY));

    it("switches to the device with its fix, its city named before the translation lands", async () => {
      mockReadLocation.mockResolvedValue({ location: JEDDAH, source: FIX_SOURCE.FRESH });
      mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);
      useLocationStore.setState({ reverseGeocode: () => new Promise(() => {}) });

      await useLocationStore.getState().adoptDeviceLocation();

      const state = useLocationStore.getState();
      expect(state.locationMode).toBe(LocationMode.DEVICE);
      expect(state.manualLocation).toBeNull();
      expect(state.manualLocationChosenAt).toBeNull();
      expect(state.lastKnownCoords).toEqual({
        latitude: JEDDAH.coords.latitude,
        longitude: JEDDAH.coords.longitude,
      });
      expect(state.localizedLocation).toEqual({ city: "Jeddah", country: "Saudi Arabia" });
    });

    it("keeps the chosen city when the device read fails", async () => {
      mockReadLocation.mockRejectedValue(new LocationFixError(LOCATION_FAILURE.TIMEOUT));

      await expect(useLocationStore.getState().adoptDeviceLocation()).rejects.toThrow();

      const state = useLocationStore.getState();
      expect(state.locationMode).toBe(LocationMode.MANUAL);
      expect(state.manualLocation).toEqual(MAKKAH_CITY);
      expect(state.lastKnownCoords).toEqual({
        latitude: MAKKAH_CITY.latitude,
        longitude: MAKKAH_CITY.longitude,
      });
      expect(state.localizedLocation.city).toBe(MAKKAH_CITY.name);
    });
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
