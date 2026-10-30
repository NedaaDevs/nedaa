import { reverseGeocodeAsync } from "@/adapters/location";
import { TRAVEL_MODE } from "@/constants/CityCheck";
import { FIX_SOURCE } from "@/constants/Location";
import { COUNTRY_CODE } from "@/constants/aladhanMethods";
import { LocationMode } from "@/enums/location";
import { useAppStore } from "@/stores/app";
import { EMPTY_MEMORY, useCityCheckStore } from "@/stores/cityCheck";
import { useLocationStore, type LocationStore } from "@/stores/location";
import { offerUp } from "@/test-helpers/cityOffer";
import { JEDDAH_CITY, RIYADH_CITY } from "@/test-helpers/place";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";
import {
  initialLocationDetails,
  type LocationGeocodedAddress,
  type LocationObject,
} from "@/types/location";
import { AppLogger } from "@/utils/appLogger";
import { readLocation } from "@/utils/location";

let mockSaved: string | null = null;

jest.mock("expo-sqlite/kv-store", () => {
  const storage = () => ({
    getItem: jest.fn(() => Promise.resolve(mockSaved)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  });
  const memory = {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  };
  return { __esModule: true, default: storage(), SQLiteStorage: jest.fn(() => memory) };
});

jest.mock("@/adapters/location", () => ({ reverseGeocodeAsync: jest.fn() }));

jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  readLocation: jest.fn(),
}));

jest.mock("@/utils/appLogger", () => {
  const log = { d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() };
  return { AppLogger: { create: () => log, registerReportSection: jest.fn() } };
});

const BAHRAIN = COUNTRY_CODE.BAHRAIN;
const SAUDI_ARABIA = RIYADH_CITY.country.name;
const RIYADH_ADDRESS = { city: RIYADH_CITY.name, country: SAUDI_ARABIA };
const SA = COUNTRY_CODE.SAUDI_ARABIA;
const log = AppLogger.create("location");

const state = () => useLocationStore.getState();
const kept = () => useCityCheckStore.getState().cityCheck.kept;
const partialized = () => useLocationStore.persist.getOptions().partialize?.(state());

const rehydrate = async (saved: Record<string, unknown>) => {
  mockSaved = JSON.stringify({ state: saved, version: 0 });
  await useLocationStore.persist.rehydrate();
};

const JEDDAH_FIX: LocationObject = {
  coords: {
    latitude: 21.4858,
    longitude: 39.1925,
    altitude: null,
    accuracy: 100,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 1_750_000_000_000,
};

const NO_ADDRESS: LocationGeocodedAddress = {
  city: null,
  district: null,
  streetNumber: null,
  street: null,
  region: null,
  subregion: null,
  country: null,
  postalCode: null,
  name: null,
  isoCountryCode: null,
  timezone: null,
  formattedAddress: null,
};

const reverseGeocode: LocationStore["reverseGeocode"] = jest.fn(async () => ({
  city: JEDDAH_CITY.name,
  countryName: SAUDI_ARABIA,
  timezone: RIYADH_ZONE,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSaved = null;
  useCityCheckStore.setState({ cityCheck: EMPTY_MEMORY });
  useAppStore.setState({ isFirstRun: false });
  useLocationStore.setState({
    locationMode: LocationMode.DEVICE,
    manualLocation: null,
    locationDetails: initialLocationDetails,
    lastKnownCoords: null,
    travelMode: TRAVEL_MODE.ASK,
    cityOffer: null,
    reverseGeocode,
  });
});

describe("travel mode", () => {
  it.each([
    [true, TRAVEL_MODE.ASK],
    [false, TRAVEL_MODE.OFF],
    [undefined, TRAVEL_MODE.ASK],
  ])("maps a saved autoUpdateLocation %s to %s", async (saved, mode) => {
    await rehydrate({ autoUpdateLocation: saved });
    expect(state().travelMode).toBe(mode);
  });

  it("keeps a saved travelMode over autoUpdateLocation", async () => {
    await rehydrate({ travelMode: TRAVEL_MODE.OFF, autoUpdateLocation: true });
    expect(state().travelMode).toBe(TRAVEL_MODE.OFF);
  });

  it("writes autoUpdateLocation for 2.x from the travel mode", () => {
    state().setTravelMode(TRAVEL_MODE.OFF);
    expect(partialized()).toMatchObject({ travelMode: TRAVEL_MODE.OFF, autoUpdateLocation: false });
    state().setTravelMode(TRAVEL_MODE.ASK);
    expect(partialized()).toMatchObject({ autoUpdateLocation: true });
  });

  it("keeps the saved place when a 2.x record loads", async () => {
    const coords = { ...initialLocationDetails.coords, latitude: 24.7, longitude: 46.7 };
    const details2x = {
      coords,
      address: RIYADH_ADDRESS,
      timezone: initialLocationDetails.timezone,
      error: null,
      fix: null,
      isLoading: false,
    };
    await rehydrate({ locationDetails: details2x, autoUpdateLocation: true });
    expect(state().locationDetails.coords).toEqual(coords);
    expect(state().locationDetails.address).toEqual(RIYADH_ADDRESS);
    expect(state().locationDetails.countryCode).toBeNull();
  });
});

describe("the city offer", () => {
  it("never saves the offer", () => {
    offerUp();
    expect(state().cityOffer).not.toBeNull();
    expect(partialized()).not.toHaveProperty("cityOffer");
  });

  it("remembers the candidate's point for the trip when the offer is kept", () => {
    offerUp();
    state().keepCityOffer();
    expect(kept()).toEqual([expect.objectContaining({ lat: 21.54, lng: 39.17 })]);
    expect(state().cityOffer).toBeNull();
  });

  it("remembers nothing when the offer is dismissed", () => {
    offerUp();
    state().dismissCityOffer();
    expect(kept()).toEqual([]);
    expect(state().cityOffer).toBeNull();
  });

  it("drops a showing offer when a city is chosen", () => {
    offerUp();
    state().setManualLocation(RIYADH_CITY);
    expect(state().cityOffer).toBeNull();
  });

  it("drops a showing offer when travel is turned off", () => {
    offerUp();
    state().setTravelMode(TRAVEL_MODE.OFF);
    expect(state().cityOffer).toBeNull();
  });
});

describe("the place's country code", () => {
  it("stores the device geocoder's country code with an updated fix", async () => {
    jest.mocked(readLocation).mockResolvedValue({ location: JEDDAH_FIX, source: FIX_SOURCE.FRESH });
    jest.mocked(reverseGeocodeAsync).mockResolvedValue([
      {
        ...NO_ADDRESS,
        city: JEDDAH_CITY.name,
        country: SAUDI_ARABIA,
        isoCountryCode: SA.toLowerCase(),
      },
    ]);

    await state().updateCurrentLocation();

    expect(state().locationDetails.countryCode).toBe(SA);
  });

  it("stores a chosen city's country code", () => {
    state().setManualLocation(RIYADH_CITY);
    expect(state().locationDetails.countryCode).toBe(RIYADH_CITY.countryCode);
  });

  it("keeps the country code in the previous place", () => {
    useLocationStore.setState({
      lastKnownCoords: { latitude: 24.7, longitude: 46.7 },
      locationDetails: { ...initialLocationDetails, countryCode: SA },
      previousPlace: null,
    });
    state().setManualLocation(RIYADH_CITY);
    expect(state().previousPlace?.countryCode).toBe(SA);
  });

  it("fills a missing country code once and never replaces one", () => {
    const { placeRevision } = state();
    state().rememberCountryCode(SA, placeRevision);
    state().rememberCountryCode(BAHRAIN, placeRevision);
    expect(state().locationDetails.countryCode).toBe(SA);
  });

  it("drops a country code found for a place since replaced", () => {
    const { placeRevision } = state();
    useLocationStore.setState({ placeRevision: placeRevision + 1 });
    state().rememberCountryCode(SA, placeRevision);
    expect(state().locationDetails.countryCode).toBeNull();
  });
});

it("logs no city name when a city is chosen", () => {
  state().setManualLocation(RIYADH_CITY);
  const lines = [log.d, log.i, log.w, log.e].flatMap((fn) =>
    jest.mocked(fn).mock.calls.map((call) => JSON.stringify(call))
  );
  expect(lines.length).toBeGreaterThan(0);
  lines.forEach((line) => {
    expect(line).not.toContain(RIYADH_CITY.name);
    expect(line).not.toContain(RIYADH_CITY.timezone);
  });
});
