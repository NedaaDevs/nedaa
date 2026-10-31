import { reverseGeocodeAsync } from "@/adapters/location";
import { REUSE_FIX_MAX_AGE_MS } from "@/constants/CityCheck";
import { FIX_SOURCE, METERS_PER_KM } from "@/constants/Location";
import { COUNTRY_CODE } from "@/constants/aladhanMethods";
import { AppLocale } from "@/enums/app";
import { LocationMode } from "@/enums/location";
import { CitiesDB } from "@/services/cities-db";
import { useAppStore } from "@/stores/app";
import { useLocationStore, type LocationStore } from "@/stores/location";
import { candidateAt, offerUp } from "@/test-helpers/cityOffer";
import { MANAMA_ROW } from "@/test-helpers/cityRows";
import { JEDDAH_CITY, MAKKAH_CITY, RIYADH_CITY } from "@/test-helpers/place";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";
import type { CitySearchResult } from "@/types/cities";
import { initialLocationDetails, type LocationObject } from "@/types/location";
import { trustedCityNear } from "@/utils/cityCheck/cityNear";
import { readLocation } from "@/utils/location";

jest.mock("@/adapters/location", () => ({ reverseGeocodeAsync: jest.fn() }));

jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  readLocation: jest.fn(),
}));

jest.mock("@/utils/cityCheck/cityNear", () => ({ trustedCityNear: jest.fn() }));

jest.mock("@/services/cities-db", () => ({
  CitiesDB: { getCity: jest.fn(), isFullPackInstalled: jest.fn() },
}));

jest.mock("@/utils/appLogger", () => {
  const log = { d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() };
  return { AppLogger: { create: () => log, registerReportSection: jest.fn() } };
});

const mockReadLocation = readLocation as jest.Mock;
const mockReverseGeocodeAsync = reverseGeocodeAsync as jest.Mock;
const mockTrustedCityNear = trustedCityNear as jest.Mock;
const mockGetCity = CitiesDB.getCity as jest.Mock;
const mockFullPack = CitiesDB.isFullPackInstalled as jest.Mock;

const state = () => useLocationStore.getState();
const applyCityCandidate: LocationStore["applyCityCandidate"] = (candidate) =>
  state().applyCityCandidate(candidate);

const ROW_ZONE = "Asia/Aden";
const JEDDAH_POINT = candidateAt().point;
const FIX_AGE_MS = 60_000;

const JEDDAH_ROW: CitySearchResult = {
  gid: 105343,
  name: JEDDAH_CITY.name,
  names: JEDDAH_CITY.names,
  latitude: JEDDAH_CITY.latitude,
  longitude: JEDDAH_CITY.longitude,
  countryCode: COUNTRY_CODE.SAUDI_ARABIA,
  country: JEDDAH_CITY.country,
  region: null,
  population: 3_976_000,
  timezone: ROW_ZONE,
};

// The same place under the full pack's id and spelling.
const FULL_PACK_JEDDAH_ROW: CitySearchResult = { ...JEDDAH_ROW, gid: 9_105_343, name: "Jiddah" };

const DEVICE_JEDDAH = {
  city: "Jeddah Governorate",
  country: "Saudi Arabia",
  isoCountryCode: "sa",
  timezone: null,
};

const STALE_FIX: LocationObject = {
  coords: {
    latitude: 21.5,
    longitude: 39.2,
    altitude: null,
    accuracy: 50,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 1_750_000_000_000,
};

const reverseGeocode: LocationStore["reverseGeocode"] = jest.fn(async () => ({
  city: JEDDAH_CITY.name,
  countryName: JEDDAH_CITY.country.name,
  timezone: RIYADH_ZONE,
}));

const RIYADH_POINT = { latitude: RIYADH_CITY.latitude, longitude: RIYADH_CITY.longitude };

const RIYADH_DETAILS = {
  ...initialLocationDetails,
  coords: { ...initialLocationDetails.coords, ...RIYADH_POINT },
  address: { country: RIYADH_CITY.country.name, city: RIYADH_CITY.name },
  timezone: RIYADH_ZONE,
  countryCode: COUNTRY_CODE.SAUDI_ARABIA,
};

describe("applyCityCandidate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({ isFirstRun: false, locale: AppLocale.EN });
    useLocationStore.setState({
      locationMode: LocationMode.DEVICE,
      manualLocation: null,
      manualLocationChosenAt: null,
      locationDetails: RIYADH_DETAILS,
      localizedLocation: { city: RIYADH_CITY.name, country: RIYADH_CITY.country.name },
      lastKnownCoords: RIYADH_POINT,
      previousPlace: null,
      placeRevision: 0,
      cityOffer: null,
      reverseGeocode,
    });
    mockFullPack.mockReturnValue(true);
    mockTrustedCityNear.mockResolvedValue(JEDDAH_ROW);
    mockReadLocation.mockResolvedValue({ location: STALE_FIX, source: FIX_SOURCE.FRESH });
    mockReverseGeocodeAsync.mockResolvedValue([DEVICE_JEDDAH]);
  });

  it("writes the candidate's point with no new read when its fix is under 5 minutes old", async () => {
    const candidate = candidateAt({ fixedAt: Date.now() - FIX_AGE_MS });

    expect(await applyCityCandidate(candidate)).toBe(true);

    expect(mockReadLocation).not.toHaveBeenCalled();
    expect(state().lastKnownCoords).toEqual(JEDDAH_POINT);
    expect(state().locationDetails.coords).toEqual(
      expect.objectContaining({
        ...JEDDAH_POINT,
        accuracy: (candidate.accuracyKm ?? 0) * METERS_PER_KM,
      })
    );
    expect(state().locationDetails.fix).toEqual({
      source: FIX_SOURCE.FRESH,
      at: candidate.fixedAt,
    });
  });

  it("reads the device again when the candidate's fix is over 5 minutes old", async () => {
    expect(
      await applyCityCandidate(candidateAt({ fixedAt: Date.now() - REUSE_FIX_MAX_AGE_MS - 1 }))
    ).toBe(true);

    expect(mockReadLocation).toHaveBeenCalledTimes(1);
    expect(mockTrustedCityNear).not.toHaveBeenCalled();
    expect(state().lastKnownCoords).toEqual({
      latitude: STALE_FIX.coords.latitude,
      longitude: STALE_FIX.coords.longitude,
    });
  });

  it("names the place from its city row in the app's language", async () => {
    useAppStore.setState({ locale: AppLocale.AR });

    await applyCityCandidate(candidateAt({ zone: null, countryCode: null }));

    expect(state().localizedLocation).toEqual({
      city: JEDDAH_ROW.names.ar,
      country: JEDDAH_ROW.country.names.ar,
    });
    expect(state().locationDetails.address).toEqual({
      city: JEDDAH_ROW.name,
      country: JEDDAH_ROW.country.name,
    });
    expect(state().locationDetails.timezone).toBe(ROW_ZONE);
    expect(state().locationDetails.countryCode).toBe(COUNTRY_CODE.SAUDI_ARABIA);
  });

  it.each([
    ["a lite pack", false, COUNTRY_CODE.SAUDI_ARABIA, 1],
    ["the full pack", true, COUNTRY_CODE.BAHRAIN, 0],
  ])(
    "takes the country from the %s's trusted source",
    async (_name, full, saved, geocoderCalls) => {
      mockFullPack.mockReturnValue(full);
      mockTrustedCityNear.mockResolvedValue({ ...JEDDAH_ROW, countryCode: COUNTRY_CODE.BAHRAIN });

      await applyCityCandidate(candidateAt({ zone: null, countryCode: null }));

      expect(state().locationDetails.countryCode).toBe(saved);
      expect(mockReverseGeocodeAsync).toHaveBeenCalledTimes(geocoderCalls);
    }
  );

  it("skips the device geocoder on a lite pack when the candidate has a country", async () => {
    mockFullPack.mockReturnValue(false);

    await applyCityCandidate(candidateAt({ countryCode: COUNTRY_CODE.SAUDI_ARABIA }));

    expect(mockReverseGeocodeAsync).not.toHaveBeenCalled();
  });

  it("drops a lite-pack row from another country for the device's place", async () => {
    mockFullPack.mockReturnValue(false);
    mockTrustedCityNear.mockResolvedValue(MANAMA_ROW);
    const translate = jest.fn(async () => true);
    useLocationStore.setState({ updateAddressTranslation: translate });

    await applyCityCandidate(candidateAt({ countryCode: null }));

    const { address, countryCode, timezone } = state().locationDetails;
    expect(address).toEqual({ city: DEVICE_JEDDAH.city, country: DEVICE_JEDDAH.country });
    expect(countryCode).toBe(COUNTRY_CODE.SAUDI_ARABIA);
    expect(timezone).not.toBe(MANAMA_ROW.timezone);
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it("keeps a lite-pack row in the device's country", async () => {
    mockFullPack.mockReturnValue(false);
    mockTrustedCityNear.mockResolvedValue(MANAMA_ROW);
    mockReverseGeocodeAsync.mockResolvedValue([
      { ...DEVICE_JEDDAH, isoCountryCode: COUNTRY_CODE.BAHRAIN },
    ]);

    await applyCityCandidate(candidateAt({ countryCode: null }));

    const { address, countryCode, timezone } = state().locationDetails;
    expect(address).toEqual({ city: MANAMA_ROW.name, country: MANAMA_ROW.country.name });
    expect(countryCode).toBe(COUNTRY_CODE.BAHRAIN);
    expect(timezone).toBe(MANAMA_ROW.timezone);
  });

  it("sends no point to the server geocoder for a candidate with a city row", async () => {
    await applyCityCandidate(candidateAt());

    expect(reverseGeocode).not.toHaveBeenCalled();
    expect(mockReverseGeocodeAsync).not.toHaveBeenCalled();
  });

  it("asks the server for the localized name of a candidate with no row", async () => {
    mockTrustedCityNear.mockResolvedValue(null);
    const translate = jest.fn(async () => true);
    useLocationStore.setState({ updateAddressTranslation: translate });

    await applyCityCandidate(candidateAt({ name: null }));

    expect(translate).toHaveBeenCalledTimes(1);
    expect(state().locationDetails.address).toEqual({
      city: DEVICE_JEDDAH.city,
      country: DEVICE_JEDDAH.country,
    });
  });

  it("keeps the previous place before writing the candidate", async () => {
    await applyCityCandidate(candidateAt());

    expect(state().previousPlace).toEqual(
      expect.objectContaining({
        coords: RIYADH_DETAILS.coords,
        address: RIYADH_DETAILS.address,
        timezone: RIYADH_ZONE,
        locationMode: LocationMode.DEVICE,
      })
    );
  });

  it("leaves a city chosen during the row lookup", async () => {
    let answer: (row: CitySearchResult) => void = () => {};
    mockTrustedCityNear.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const applying = applyCityCandidate(candidateAt());
    state().setManualLocation(MAKKAH_CITY);
    answer(JEDDAH_ROW);
    expect(await applying).toBe(false);

    expect(state().manualLocation).toEqual(MAKKAH_CITY);
    expect(state().lastKnownCoords).toEqual({
      latitude: MAKKAH_CITY.latitude,
      longitude: MAKKAH_CITY.longitude,
    });
    expect(state().locationDetails.address?.city).toBe(MAKKAH_CITY.name);
  });

  // Each guard on its own: the place moved, or the mode left the device.
  it.each<[string, () => void]>([
    [
      "a device write moves the place",
      () => useLocationStore.setState({ placeRevision: state().placeRevision + 1 }),
    ],
    [
      "the mode turns to a chosen city",
      () => useLocationStore.setState({ locationMode: LocationMode.MANUAL }),
    ],
  ])("writes nothing when %s during the row lookup", async (_case, change) => {
    let answer: (row: CitySearchResult) => void = () => {};
    mockTrustedCityNear.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const applying = applyCityCandidate(candidateAt());
    change();
    answer(JEDDAH_ROW);

    expect(await applying).toBe(false);
    expect(state().lastKnownCoords).toEqual(RIYADH_POINT);
    expect(state().locationDetails).toEqual(RIYADH_DETAILS);
  });

  it("leaves a city chosen while a candidate with no row is named", async () => {
    mockTrustedCityNear.mockResolvedValue(null);
    let answer: () => void = () => {};
    const asked = new Promise<void>((named) =>
      mockReverseGeocodeAsync.mockImplementation(() => {
        named();
        return new Promise((resolve) => (answer = () => resolve([DEVICE_JEDDAH])));
      })
    );

    const applying = applyCityCandidate(candidateAt({ name: null }));
    await asked;
    state().setManualLocation(MAKKAH_CITY);
    answer();
    await applying;

    expect(state().manualLocation).toEqual(MAKKAH_CITY);
    expect(state().locationMode).toBe(LocationMode.MANUAL);
    expect(state().locationDetails.address?.city).toBe(MAKKAH_CITY.name);
  });

  it("names the candidate from the row near its point after the full pack installs", async () => {
    mockTrustedCityNear.mockResolvedValue(FULL_PACK_JEDDAH_ROW);

    await applyCityCandidate(candidateAt());

    expect(mockTrustedCityNear).toHaveBeenCalledWith(JEDDAH_POINT);
    expect(state().locationDetails.address?.city).toBe(FULL_PACK_JEDDAH_ROW.name);
    expect(mockGetCity).not.toHaveBeenCalled();
  });

  it("writes nothing when a city is chosen during the device read of a stale fix", async () => {
    let answer: () => void = () => {};
    mockReadLocation.mockReturnValue(
      new Promise((resolve) => {
        answer = () => resolve({ location: STALE_FIX, source: FIX_SOURCE.FRESH });
      })
    );

    const applying = applyCityCandidate(
      candidateAt({ fixedAt: Date.now() - REUSE_FIX_MAX_AGE_MS - 1 })
    );
    state().setManualLocation(MAKKAH_CITY);
    answer();

    expect(await applying).toBe(false);
    expect(state().manualLocation).toEqual(MAKKAH_CITY);
  });

  it("keeps the offer up while its own update writes the place", async () => {
    offerUp();

    await applyCityCandidate(candidateAt());

    expect(state().cityOffer).not.toBeNull();
  });
});
