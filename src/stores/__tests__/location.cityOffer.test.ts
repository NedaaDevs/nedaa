import { reverseGeocodeAsync } from "@/adapters/location";
import { NOT_ASKED_MAX, TRAVEL_MODE } from "@/constants/CityCheck";
import { CITY_OFFER_STAGE } from "@/constants/CityOffer";
import { FIX_SOURCE } from "@/constants/Location";
import { COUNTRY_CODE } from "@/constants/aladhanMethods";
import { LocationMode } from "@/enums/location";
import { useAppStore } from "@/stores/app";
import { EMPTY_MEMORY, useCityCheckStore } from "@/stores/cityCheck";
import { selectOfferUp, useLocationStore, type LocationStore } from "@/stores/location";
import { candidateAt, offerUp } from "@/test-helpers/cityOffer";
import { JEDDAH_CITY, RIYADH_CITY } from "@/test-helpers/place";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";
import {
  initialLocationDetails,
  type LocationGeocodedAddress,
  type LocationObject,
  type PlaceRecord,
} from "@/types/location";
import { AppLogger } from "@/utils/appLogger";
import { toPlaceMark } from "@/utils/cityCheck/marks";
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
const NOW = 1_750_000_000_000;
const JEDDAH_POINT = candidateAt().point;
// About 3 km from Jeddah.
const JEDDAH_2_POINT = { latitude: 21.5633, longitude: 39.1928 };
const DUBAI_POINT = { latitude: 25.2, longitude: 55.27 };
const RIYADH_COORDS = { ...initialLocationDetails.coords, latitude: 24.7136, longitude: 46.6753 };
const RIYADH_PLACE: PlaceRecord = {
  coords: RIYADH_COORDS,
  address: RIYADH_ADDRESS,
  timezone: RIYADH_ZONE,
  fixSource: FIX_SOURCE.FRESH,
  fixedAt: NOW - 1_000,
  countryCode: SA,
  localizedLocation: { city: RIYADH_CITY.name, country: SAUDI_ARABIA },
  locationMode: LocationMode.DEVICE,
  manualLocation: null,
};

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
    expect(state().cityOffer?.stage.kind).toBe(CITY_OFFER_STAGE.KEPT);
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

describe("the offer's answers", () => {
  const notAsked = () => useCityCheckStore.getState().cityCheck.notAsked;

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });
  afterEach(() => jest.restoreAllMocks());

  it("puts a new offer up unanswered and unannounced", () => {
    offerUp();
    expect(state().cityOffer).toMatchObject({
      stage: { kind: CITY_OFFER_STAGE.OFFER },
      announced: false,
      from: null,
    });
  });

  it("keeps the offer up on Keep and records the place for this trip", () => {
    offerUp();
    state().keepCityOffer();
    expect(state().cityOffer?.stage.kind).toBe(CITY_OFFER_STAGE.KEPT);
    expect(kept()[0]).toEqual(toPlaceMark(JEDDAH_POINT, NOW, candidateAt().countryCode));
  });

  it("mutes the offer's place, newest first, at most NOT_ASKED_MAX", () => {
    const points = Array.from({ length: NOT_ASKED_MAX + 1 }, (_, i) => ({
      latitude: 10 + i,
      longitude: 40,
    }));
    points.forEach((point) => {
      offerUp(candidateAt({ point }));
      state().muteCityOffer();
    });
    expect(notAsked()).toHaveLength(NOT_ASKED_MAX);
    expect(notAsked()[0]).toEqual(
      toPlaceMark(points[NOT_ASKED_MAX], NOW, candidateAt().countryCode)
    );
  });

  it("sets the offer to muted and carries the country in the mark", () => {
    offerUp();
    state().muteCityOffer();
    expect(state().cityOffer?.stage.kind).toBe(CITY_OFFER_STAGE.MUTED);
    expect(notAsked()[0]?.countryCode).toBe(candidateAt().countryCode);
  });

  it("replaces a muted mark the new one matches rather than adding a second", () => {
    offerUp();
    state().muteCityOffer();
    offerUp(candidateAt({ point: JEDDAH_2_POINT }));
    state().muteCityOffer();
    expect(notAsked()).toEqual([toPlaceMark(JEDDAH_2_POINT, NOW, candidateAt().countryCode)]);
  });

  it("asks again in exactly the mark taken off the list", () => {
    const jeddah = toPlaceMark(JEDDAH_POINT, NOW);
    const dubai = toPlaceMark(DUBAI_POINT, NOW);
    useCityCheckStore.getState().mute(jeddah);
    useCityCheckStore.getState().mute(dubai);
    useCityCheckStore.getState().askAgainIn(jeddah);
    expect(notAsked()).toEqual([dubai]);
  });

  it("marks the offer announced", () => {
    offerUp();
    state().markCityOfferAnnounced();
    expect(state().cityOffer?.announced).toBe(true);
  });

  it("keeps the first saved city after a Retry from a stop at notifications", () => {
    offerUp();
    state().startCityOfferUse({ city: "Riyadh", zone: RIYADH_ZONE });
    state().startCityOfferUse({ city: "Jeddah", zone: RIYADH_ZONE });
    expect(state().cityOffer?.from).toEqual({ city: "Riyadh", zone: RIYADH_ZONE });
  });

  it("notes where the times came from when Use starts, then settles as updated", () => {
    offerUp();
    state().startCityOfferUse({ city: "Riyadh", zone: RIYADH_ZONE });
    state().settleCityOffer({ kind: CITY_OFFER_STAGE.UPDATED, alertsFollow: true });
    expect(state().cityOffer).toMatchObject({
      from: { city: "Riyadh", zone: RIYADH_ZONE },
      stage: { kind: CITY_OFFER_STAGE.UPDATED, alertsFollow: true },
    });
  });

  it("changes nothing when no offer is up", () => {
    state().markCityOfferAnnounced();
    state().startCityOfferUse({ city: "Riyadh", zone: RIYADH_ZONE });
    state().settleCityOffer({ kind: CITY_OFFER_STAGE.KEPT });
    state().keepCityOffer();
    state().muteCityOffer();
    expect(state().cityOffer).toBeNull();
    expect(kept()).toEqual([]);
    expect(notAsked()).toEqual([]);
  });

  it("reports an offer up only while one exists", () => {
    expect(selectOfferUp(state())).toBe(false);
    offerUp();
    expect(selectOfferUp(state())).toBe(true);
  });

  describe("restorePreviousPlace", () => {
    it("puts the previous place back and bumps the place revision", () => {
      useLocationStore.setState({
        previousPlace: RIYADH_PLACE,
        placeRevision: 4,
        locationMode: LocationMode.MANUAL,
        manualLocation: RIYADH_CITY,
        lastKnownCoords: JEDDAH_POINT,
        localizedLocation: { city: JEDDAH_CITY.name, country: SAUDI_ARABIA },
        locationDetails: {
          ...initialLocationDetails,
          countryCode: BAHRAIN,
          timezone: "Asia/Bahrain",
        },
      });

      expect(state().restorePreviousPlace()).toBe(true);

      expect(state().locationDetails).toMatchObject({
        coords: RIYADH_COORDS,
        address: RIYADH_ADDRESS,
        timezone: RIYADH_ZONE,
        countryCode: SA,
        error: null,
        fix: { source: FIX_SOURCE.FRESH, at: RIYADH_PLACE.fixedAt },
      });
      expect(state().localizedLocation).toEqual(RIYADH_PLACE.localizedLocation);
      expect(state().lastKnownCoords).toEqual({
        latitude: RIYADH_COORDS.latitude,
        longitude: RIYADH_COORDS.longitude,
      });
      expect(state().locationMode).toBe(LocationMode.DEVICE);
      expect(state().manualLocation).toBeNull();
      expect(state().previousPlace).toBeNull();
      expect(state().placeRevision).toBe(5);
    });

    it("restores nothing when no previous place is kept", () => {
      useLocationStore.setState({ previousPlace: null, placeRevision: 4 });
      expect(state().restorePreviousPlace()).toBe(false);
      expect(state().placeRevision).toBe(4);
    });
  });
});

describe("an offer and the place beneath it", () => {
  const hold = (revision: number) =>
    useLocationStore.setState({ previousPlace: RIYADH_PLACE, placeRevision: revision });
  const placeLanded = () => state().cityOffer?.placeLanded;

  it("starts with no times landed for the place it asks about", () => {
    offerUp();
    expect(placeLanded()).toBe(false);
  });

  it("notes the landed times when a Use held the previous place", () => {
    offerUp();
    state().startCityOfferUse({ city: "Riyadh", zone: RIYADH_ZONE });
    hold(4);

    state().settlePlace(4);

    expect(placeLanded()).toBe(true);
    expect(state().previousPlace).toBeNull();
  });

  it("notes nothing when no Use started", () => {
    offerUp();
    hold(4);

    state().settlePlace(4);

    expect(placeLanded()).toBe(false);
    expect(state().previousPlace).toBeNull();
  });

  it("notes nothing when no previous place is held", () => {
    offerUp();
    state().startCityOfferUse({ city: "Riyadh", zone: RIYADH_ZONE });
    useLocationStore.setState({ previousPlace: null, placeRevision: 4 });

    state().settlePlace(4);

    expect(placeLanded()).toBe(false);
  });

  it("notes nothing for a place since replaced", () => {
    offerUp();
    state().startCityOfferUse({ city: "Riyadh", zone: RIYADH_ZONE });
    hold(5);

    state().settlePlace(4);

    expect(placeLanded()).toBe(false);
    expect(state().previousPlace).toEqual(RIYADH_PLACE);
  });

  describe("when the device writes a new place", () => {
    beforeEach(() => {
      jest
        .mocked(readLocation)
        .mockResolvedValue({ location: JEDDAH_FIX, source: FIX_SOURCE.FRESH });
      jest.mocked(reverseGeocodeAsync).mockResolvedValue([
        {
          ...NO_ADDRESS,
          city: JEDDAH_CITY.name,
          country: SAUDI_ARABIA,
          isoCountryCode: SA.toLowerCase(),
        },
      ]);
    });

    it.each([CITY_OFFER_STAGE.KEPT, CITY_OFFER_STAGE.MUTED, CITY_OFFER_STAGE.UPDATED] as const)(
      "drops an offer already answered, at %s",
      async (kind) => {
        offerUp(
          candidateAt(),
          kind === CITY_OFFER_STAGE.UPDATED ? { kind, alertsFollow: true } : { kind }
        );

        await state().updateCurrentLocation();

        expect(state().cityOffer).toBeNull();
      }
    );

    it("keeps an offer still waiting for its answer", async () => {
      offerUp();

      await state().updateCurrentLocation();

      expect(state().cityOffer?.stage.kind).toBe(CITY_OFFER_STAGE.OFFER);
    });
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
