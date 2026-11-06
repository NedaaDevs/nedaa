import { renderHook } from "@testing-library/react-native";

import { reverseGeocodeAsync } from "@/adapters/location";
import { FIX_SOURCE, LOCATION_FAILURE, knownPlaceName } from "@/constants/Location";
import { LocationMode } from "@/enums/location";
import { useNewestPlace } from "@/hooks/usePlace";
import { useAppStore } from "@/stores/app";
import { useLocationStore, type LocationStore } from "@/stores/location";
import { initialLocationDetails, type LocationObject } from "@/types/location";
import { later } from "@/test-helpers/promises";
import { LocationFixError, readLocation, type LocationFix } from "@/utils/location";
import { MAKKAH_CITY } from "@/test-helpers/place";

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
}));

jest.mock("@/utils/appLogger", () => {
  const log = { d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() };
  return { AppLogger: { create: () => log, registerReportSection: jest.fn() } };
});

const mockReadLocation = readLocation as jest.Mock;
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

    expect(useLocationStore.getState().locationDetails.fix?.source).toBe(FIX_SOURCE.LAST_KNOWN);
  });

  it("records the source of an updated fix", async () => {
    mockReadLocation.mockResolvedValue({ location: JEDDAH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);

    await useLocationStore.getState().updateCurrentLocation();

    expect(useLocationStore.getState().locationDetails.fix?.source).toBe(FIX_SOURCE.FRESH);
  });

  it("names the updated fix's city in the stored address", async () => {
    mockReadLocation.mockResolvedValue({ location: JEDDAH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);

    await useLocationStore.getState().updateCurrentLocation();

    expect(useLocationStore.getState().locationDetails.address?.city).toBe("Jeddah");
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
      const { result } = await renderHook(() => useNewestPlace());
      expect(result.current.city).toBe(localized.city);
    });

    it("clears the saved name when the fix is in another city", async () => {
      mockReadLocation.mockResolvedValue({ location: JEDDAH, source: FIX_SOURCE.FRESH });

      await useLocationStore.getState().updateCurrentLocation();

      expect(
        knownPlaceName(useLocationStore.getState().locationDetails.address?.city)
      ).toBeUndefined();
      const { result } = await renderHook(() => useNewestPlace());
      expect(result.current.city).toBeUndefined();
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
    const { result } = await renderHook(() => useNewestPlace());
    expect(result.current.city).toBeUndefined();
  });

  it("takes a zone as the place's own", () => {
    useLocationStore.getState().setTimezone("Asia/Dubai");

    expect(useLocationStore.getState().locationDetails.timezone).toBe("Asia/Dubai");
  });

  it("records when the first fix was observed", async () => {
    mockReadLocation.mockResolvedValue({ location: RIYADH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Riyadh")]);

    await useLocationStore.getState().initializeLocation();

    expect(useLocationStore.getState().locationDetails.fix?.at).toBe(RIYADH.timestamp);
  });

  it("records when an updated fix was observed, which a cached fix dates earlier", async () => {
    const cached = { ...JEDDAH, timestamp: JEDDAH.timestamp - 60_000 };
    mockReadLocation.mockResolvedValue({ location: cached, source: FIX_SOURCE.LAST_KNOWN });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);

    await useLocationStore.getState().updateCurrentLocation();

    expect(useLocationStore.getState().locationDetails.fix?.at).toBe(cached.timestamp);
  });

  it("keeps no fix for a chosen city", () => {
    useLocationStore.setState({
      locationDetails: {
        ...initialLocationDetails,
        fix: { source: FIX_SOURCE.FRESH, at: RIYADH.timestamp },
      },
    });

    useLocationStore.getState().setManualLocation(MAKKAH_CITY);

    expect(useLocationStore.getState().locationDetails.fix).toBeNull();
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

  // A try past its deadline leaves its read running while the next one runs.
  describe("the reading flag while device reads overlap", () => {
    const fresh = (location: LocationObject): LocationFix => ({
      location,
      source: FIX_SOURCE.FRESH,
    });

    beforeEach(() => {
      useLocationStore.setState({ isGettingLocation: false });
      mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Riyadh")]);
    });

    it("stays up while the next try's fix runs", async () => {
      const first = later<LocationFix>();
      const next = later<LocationFix>();
      mockReadLocation.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
      let wanted = true;
      const abandoned = useLocationStore.getState().initializeLocation(() => wanted);
      wanted = false;
      const retry = useLocationStore.getState().initializeLocation();

      first.release(fresh(RIYADH));
      await abandoned;

      expect(useLocationStore.getState().isGettingLocation).toBe(true);
      next.release(fresh(RIYADH));
      await retry;
      expect(useLocationStore.getState().isGettingLocation).toBe(false);
    });

    it("stays up while an update read outlives the first fix", async () => {
      const first = later<LocationFix>();
      const update = later<LocationFix>();
      mockReadLocation.mockReturnValueOnce(first.promise).mockReturnValueOnce(update.promise);
      const fix = useLocationStore.getState().initializeLocation();
      const refresh = useLocationStore.getState().updateCurrentLocation();

      first.release(fresh(RIYADH));
      await fix;

      expect(useLocationStore.getState().isGettingLocation).toBe(true);
      update.release(fresh(RIYADH));
      await refresh;
      expect(useLocationStore.getState().isGettingLocation).toBe(false);
    });

    it("comes down once a fix its caller gave up on settles with no read after it", async () => {
      const first = later<LocationFix>();
      mockReadLocation.mockReturnValueOnce(first.promise);
      let wanted = true;
      const abandoned = useLocationStore.getState().initializeLocation(() => wanted);
      wanted = false;

      first.release(fresh(RIYADH));
      await abandoned;

      expect(useLocationStore.getState().isGettingLocation).toBe(false);
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

  /** The state a saved record restores into, through the store's own merge. */
  const restored = (saved: unknown): LocationStore => {
    const { merge } = useLocationStore.persist.getOptions();
    if (!merge) throw new Error("the location store persists with no merge");
    return merge(saved, useLocationStore.getState());
  };

  it("drops a saved error that is not a failure kind", () => {
    const saved = {
      locationDetails: { ...initialLocationDetails, error: "Location request timed out" },
    };

    expect(restored(saved).locationDetails.error).toBeNull();
  });

  it("gives a saved record with no fix field no fix", () => {
    const { fix: _fix, ...withoutFix } = initialLocationDetails;
    const saved = { locationDetails: withoutFix };

    expect(restored(saved).locationDetails.fix).toBeNull();
  });

  it("drops the fix fields an older saved record kept", () => {
    const { fix: _fix, ...details } = { ...initialLocationDetails, coords: RIYADH.coords };
    const saved = {
      locationDetails: { ...details, fixSource: FIX_SOURCE.FRESH, fixedAt: RIYADH.timestamp },
    };

    expect(restored(saved).locationDetails).toEqual({ ...details, fix: null });
  });

  it("keeps a saved failure kind", () => {
    const saved = {
      locationDetails: { ...initialLocationDetails, error: LOCATION_FAILURE.TIMEOUT },
    };

    expect(restored(saved).locationDetails.error).toBe(LOCATION_FAILURE.TIMEOUT);
  });
});
