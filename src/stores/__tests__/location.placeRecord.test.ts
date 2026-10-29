import { reverseGeocodeAsync } from "@/adapters/location";
import { FIX_SOURCE } from "@/constants/Location";
import { LocationMode } from "@/enums/location";
import { useAppStore } from "@/stores/app";
import { useLocationStore, type LocationStore } from "@/stores/location";
import { initialLocationDetails, type LocationObject, type ManualLocation } from "@/types/location";
import { readLocation } from "@/utils/location";
import { JEDDAH_CITY, MAKKAH_CITY, RIYADH_CITY } from "@/test-helpers/place";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";

jest.mock("@/adapters/location", () => ({
  reverseGeocodeAsync: jest.fn(),
}));

jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  readLocation: jest.fn(),
}));

jest.mock("@/utils/appLogger", () => {
  const log = { d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() };
  return { AppLogger: { create: () => log } };
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
const RIYADH_COORDS = { latitude: RIYADH.coords.latitude, longitude: RIYADH.coords.longitude };

const deviceAddress = (city: string) => ({ city, country: "Saudi Arabia", timezone: null });

const reverseGeocode: LocationStore["reverseGeocode"] = jest.fn(async () => ({
  city: "Jeddah",
  countryName: "Saudi Arabia",
  timezone: RIYADH_ZONE,
}));

/** Chooses `city`, then settles it as its times would. */
const chooseAndSettle = (city: ManualLocation) => {
  useLocationStore.getState().setManualLocation(city);
  useLocationStore.getState().settlePlace(useLocationStore.getState().placeRevision);
};

describe("the place record and the place revision", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationStore.setState({
      locationMode: LocationMode.DEVICE,
      manualLocation: null,
      manualLocationChosenAt: null,
      locationDetails: {
        ...initialLocationDetails,
        coords: RIYADH.coords,
        address: { country: "Saudi Arabia", city: "Riyadh" },
      },
      localizedLocation: { city: "", country: "" },
      lastKnownCoords: RIYADH_COORDS,
      previousPlace: null,
      placeRevision: 0,
      reverseGeocode,
    });
    useAppStore.setState({ isFirstRun: false });
    mockReadLocation.mockResolvedValue({ location: JEDDAH, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([deviceAddress("Jeddah")]);
  });

  describe("from a chosen city whose times landed", () => {
    beforeEach(() => chooseAndSettle(RIYADH_CITY));

    const asIs = () => {};

    // Every writer, one invariant. `arrange` runs before the watch starts.
    it.each<[string, () => Promise<void>, () => void]>([
      [
        "a chosen city",
        async () => useLocationStore.getState().setManualLocation(MAKKAH_CITY),
        asIs,
      ],
      ["a cleared city", async () => useLocationStore.getState().clearManualLocation(), asIs],
      ["a device update", () => useLocationStore.getState().updateCurrentLocation(), asIs],
      ["the switch to the device", () => useLocationStore.getState().adoptDeviceLocation(), asIs],
      // A chosen city stops initializeLocation; this row starts on the device.
      [
        "the first fix",
        () => useLocationStore.getState().initializeLocation(),
        () => {
          useLocationStore.setState({
            locationMode: LocationMode.DEVICE,
            manualLocation: null,
            lastKnownCoords: null,
          });
        },
      ],
    ])("moves the revision on every new point that %s writes", async (_name, write, arrange) => {
      arrange();
      const missed: number[] = [];
      const stop = useLocationStore.subscribe((now, before) => {
        const moved =
          now.locationDetails.coords !== before.locationDetails.coords ||
          now.lastKnownCoords !== before.lastKnownCoords;
        if (moved && now.placeRevision === before.placeRevision) missed.push(now.placeRevision);
      });
      const start = useLocationStore.getState().placeRevision;

      await write();
      stop();

      expect(missed).toEqual([]);
      expect(useLocationStore.getState().placeRevision).toBeGreaterThan(start);
    });

    it("keeps the revision when the same point is named again", async () => {
      const before = useLocationStore.getState().placeRevision;

      await useLocationStore.getState().updateAddressTranslation();
      useLocationStore.getState().setTimezone("Asia/Dubai");

      expect(useLocationStore.getState().placeRevision).toBe(before);
    });

    it("keeps the chosen city as the previous place when another city is chosen", () => {
      useLocationStore.getState().setManualLocation(MAKKAH_CITY);

      expect(useLocationStore.getState().previousPlace).toEqual(
        expect.objectContaining({
          coords: expect.objectContaining({
            latitude: RIYADH_CITY.latitude,
            longitude: RIYADH_CITY.longitude,
          }),
          locationMode: LocationMode.MANUAL,
          manualLocation: RIYADH_CITY,
          timezone: RIYADH_CITY.timezone,
        })
      );
    });

    // A second change before the first one's times land.
    it("keeps the first previous place through a second write", () => {
      useLocationStore.getState().setManualLocation(MAKKAH_CITY);
      useLocationStore.getState().setManualLocation(JEDDAH_CITY);

      expect(useLocationStore.getState().previousPlace?.manualLocation).toEqual(RIYADH_CITY);
    });

    it("keeps the chosen city as the previous place when the device replaces it", async () => {
      await useLocationStore.getState().adoptDeviceLocation();

      expect(useLocationStore.getState().previousPlace?.manualLocation).toEqual(RIYADH_CITY);
    });

    it("settles only the revision the times were fetched for", () => {
      useLocationStore.getState().setManualLocation(MAKKAH_CITY);
      const { placeRevision, settlePlace } = useLocationStore.getState();

      settlePlace(placeRevision - 1);
      expect(useLocationStore.getState().previousPlace).not.toBeNull();

      settlePlace(placeRevision);
      expect(useLocationStore.getState().previousPlace).toBeNull();
    });

    // A restart between the place write and the times.
    it("saves the previous place and the revision", () => {
      useLocationStore.getState().setManualLocation(MAKKAH_CITY);

      const saved = useLocationStore.persist.getOptions().partialize?.(useLocationStore.getState());

      expect(saved).toEqual(
        expect.objectContaining({
          previousPlace: expect.objectContaining({ manualLocation: RIYADH_CITY }),
          placeRevision: useLocationStore.getState().placeRevision,
        })
      );
    });
  });

  it("keeps the device place, with its names and fix, before a new fix", async () => {
    useLocationStore.setState({
      localizedLocation: { city: "الرياض", country: "السعودية" },
      locationDetails: {
        ...useLocationStore.getState().locationDetails,
        fix: { source: FIX_SOURCE.FRESH, at: RIYADH.timestamp },
      },
    });

    await useLocationStore.getState().updateCurrentLocation();

    expect(useLocationStore.getState().previousPlace).toEqual(
      expect.objectContaining({
        coords: RIYADH.coords,
        locationMode: LocationMode.DEVICE,
        localizedLocation: { city: "الرياض", country: "السعودية" },
        fixSource: FIX_SOURCE.FRESH,
        fixedAt: RIYADH.timestamp,
      })
    );
  });

  it("holds no previous place for the first place ever written", () => {
    useLocationStore.setState({ lastKnownCoords: null, previousPlace: null });

    useLocationStore.getState().setManualLocation(MAKKAH_CITY);

    expect(useLocationStore.getState().previousPlace).toBeNull();
  });

  it("reads a record saved before both fields existed", () => {
    const merged = useLocationStore.persist
      .getOptions()
      .merge?.({ lastKnownCoords: RIYADH_COORDS }, useLocationStore.getInitialState());

    expect(merged).toEqual(
      expect.objectContaining({
        lastKnownCoords: RIYADH_COORDS,
        previousPlace: null,
        placeRevision: 0,
      })
    );
  });

  it("leaves a newer fix in place when the first fix's naming ends late", async () => {
    useLocationStore.setState({ lastKnownCoords: null, locationMode: LocationMode.DEVICE });
    mockReadLocation
      .mockResolvedValueOnce({ location: RIYADH, source: FIX_SOURCE.LAST_KNOWN })
      .mockResolvedValueOnce({ location: JEDDAH, source: FIX_SOURCE.FRESH });
    let nameFirst: () => void = () => {};
    mockReverseGeocodeAsync
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            nameFirst = () => resolve([deviceAddress("Riyadh")]);
          })
      )
      .mockResolvedValueOnce([deviceAddress("Jeddah")]);

    const first = useLocationStore.getState().initializeLocation();
    await useLocationStore.getState().updateCurrentLocation();
    nameFirst();
    await first;

    expect(useLocationStore.getState().lastKnownCoords).toEqual({
      latitude: JEDDAH.coords.latitude,
      longitude: JEDDAH.coords.longitude,
    });
    expect(useLocationStore.getState().locationDetails.address?.city).toBe("Jeddah");
  });

  // A shared log names no place.
  it("logs a chosen city without its name or zone", () => {
    const log = jest.requireMock("@/utils/appLogger").AppLogger.create();

    useLocationStore.getState().setManualLocation(MAKKAH_CITY);

    const lines = JSON.stringify(log.i.mock.calls);
    expect(lines).not.toContain(MAKKAH_CITY.name);
    expect(lines).not.toContain(MAKKAH_CITY.timezone);
  });
});
