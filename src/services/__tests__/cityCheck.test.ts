import { AppState, type AppStateStatus } from "react-native";

import { APP_STATE } from "@/constants/AppState";
import {
  CHECK_MIN_AWAY_MS,
  CHECK_THROTTLE_MS,
  CITY_CHECK_END,
  CITY_CHECK_OFFER,
  CITY_CHECK_SKIP,
  CITY_CHECK_TRIGGER,
  CONFIRM_FIX_DELAY_MS,
  MEMORY_LOAD_TIMEOUT_MS,
  TRAVEL_MODE,
  type CityCheckReason,
  type CityCheckTrigger,
} from "@/constants/CityCheck";
import { UPDATE_START } from "@/constants/Location";
import { COUNTRY_CODE } from "@/constants/aladhanMethods";
import { LocationMode, LocalPermissionStatus } from "@/enums/location";
import { candidateAt } from "@/test-helpers/cityOffer";
import { JEDDAH_ROW, MANAMA_ROW } from "@/test-helpers/cityRows";
import { holdHydration } from "@/test-helpers/hydration";
import { never } from "@/test-helpers/promises";
import { DUBAI_ZONE } from "@/test-helpers/place";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";
import type { Coords, LocationGeocodedAddress, LocationObject } from "@/types/location";
import { toPlaceMark } from "@/utils/cityCheck/marks";

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockServicesEnabled = jest.fn();
const mockCurrentPosition = jest.fn();
const mockLastKnown = jest.fn();
const mockReverseGeocode = jest.fn();
const mockFindNearestCity = jest.fn();
const mockFullPack = jest.fn();
const mockPhoneZone = jest.fn();
const mockLog = { d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() };

jest.mock("@/adapters/location", () => ({
  LocationAccuracy: jest.requireActual("@/enums/location").LocationAccuracy,
  usesHmsLocation: () => false,
  getForegroundPermissionsAsync: () => mockGetPermissions(),
  requestForegroundPermissionsAsync: () => mockRequestPermissions(),
  hasServicesEnabledAsync: () => mockServicesEnabled(),
  getCurrentPositionAsync: (options: unknown) => mockCurrentPosition(options),
  getLastKnownPositionAsync: (maxAgeMs: number) => mockLastKnown(maxAgeMs),
  reverseGeocodeAsync: (point: unknown) => mockReverseGeocode(point),
}));
jest.mock("@/services/cities-db", () => {
  const db = {
    findNearestCity: (latitude: number, longitude: number) =>
      mockFindNearestCity(latitude, longitude),
    isFullPackInstalled: () => mockFullPack(),
  };
  return {
    __esModule: true,
    CitiesDB: db,
    default: db,
    isFullPackInstalled: db.isFullPackInstalled,
  };
});
jest.mock("@/utils/phoneZone", () => ({ readPhoneZone: () => mockPhoneZone() }));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => mockLog, registerReportSection: jest.fn() },
}));

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;
const NOW = Date.UTC(2026, 0, 1, 9);
const FIX_ACCURACY_M = 100;
const ROW_DISTANCE_KM = 3;
const SA = COUNTRY_CODE.SAUDI_ARABIA;
const BAHRAIN = MANAMA_ROW.countryCode;
const { LAUNCH, RETURN } = CITY_CHECK_TRIGGER;

const MAKKAH: Coords = { latitude: 21.4225, longitude: 39.8262 };
const MAKKAH_2: Coords = { latitude: 21.4231, longitude: 39.8271 };
const JEDDAH: Coords = { latitude: 21.5433, longitude: 39.1728 };
const JEDDAH_2: Coords = { latitude: 21.5441, longitude: 39.1739 };
const DAMMAM: Coords = { latitude: 26.4207, longitude: 50.0888 };
const KHOBAR: Coords = { latitude: 26.2172, longitude: 50.1971 };
const MANAMA: Coords = { latitude: 26.2285, longitude: 50.586 };

type Runner = typeof import("@/services/cityCheck");
type Loaded = Runner & {
  location: typeof import("@/stores/location").useLocationStore;
  memory: typeof import("@/stores/cityCheck").useCityCheckStore;
  app: typeof import("@/stores/app").useAppStore;
  update: typeof import("@/stores/locationUpdate").useLocationUpdateStore;
};

let loaded: Loaded;
// React Native's lazy getters resolve outside the isolate, to this AppState.
const appListeners: ((status: AppStateStatus) => void)[] = [];

const location = () => loaded.location.getState();
const memory = () => loaded.memory.getState().cityCheck;

const setAppState = (status: AppStateStatus) => {
  (AppState as { currentState: AppStateStatus }).currentState = status;
};
const emitAppState = (status: AppStateStatus) => {
  setAppState(status);
  [...appListeners].forEach((listener) => listener(status));
};

/** The runner and the stores it reads, fresh, with a saved place. */
const load = async (saved: Coords = MAKKAH, countryCode: string | null = SA) => {
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    loaded = {
      ...(require("@/services/cityCheck") as Runner),
      location: require("@/stores/location").useLocationStore,
      memory: require("@/stores/cityCheck").useCityCheckStore,
      app: require("@/stores/app").useAppStore,
      update: require("@/stores/locationUpdate").useLocationUpdateStore,
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  appListeners.length = 0;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    const own = listener as (status: AppStateStatus) => void;
    appListeners.push(own);
    return { remove: () => appListeners.splice(appListeners.indexOf(own), 1) };
  });
  setAppState(APP_STATE.ACTIVE);
  // Each store reads its disk once; seeds land after that read.
  await jest.advanceTimersByTimeAsync(0);
  loaded.app.setState({ isFirstRun: false });
  loaded.location.setState({
    locationMode: LocationMode.DEVICE,
    travelMode: TRAVEL_MODE.ASK,
    cityOffer: null,
    lastKnownCoords: saved,
    locationDetails: {
      ...location().locationDetails,
      coords: { ...location().locationDetails.coords, ...saved, accuracy: null },
      timezone: RIYADH_ZONE,
      countryCode,
    },
  });
};

const fixAt = (point: Coords, timestamp: number = Date.now()): LocationObject => ({
  coords: {
    ...point,
    altitude: null,
    accuracy: FIX_ACCURACY_M,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp,
});

/** Each fresh read answers the next point, fixed at the read's time. */
const freshFixes = (...points: Coords[]) => {
  const queue = [...points];
  mockCurrentPosition.mockImplementation(async () => fixAt(queue.shift() ?? points.at(-1)!));
};

const address = (over: Partial<LocationGeocodedAddress>): LocationGeocodedAddress => ({
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
  ...over,
});

const rowNear = (row: typeof JEDDAH_ROW) =>
  mockFindNearestCity.mockResolvedValue({ city: row, distanceKm: ROW_DISTANCE_KM });

/** Runs a check through its second-fix wait. */
const settle = async (run: Promise<void>) => {
  await jest.advanceTimersByTimeAsync(CONFIRM_FIX_DELAY_MS);
  await run;
};
const check = (trigger: CityCheckTrigger = LAUNCH) => settle(loaded.runCityCheck(trigger));

const allLogText = () =>
  Object.values(mockLog)
    .flatMap((fn) => fn.mock.calls)
    .map((args) => args.map(String).join(" "))
    .join("\n");
const ended = (trigger: string, reason: CityCheckReason) =>
  expect(allLogText()).toContain(`${trigger} → ${reason}`);
const endCount = (reason: CityCheckReason) =>
  allLogText()
    .split("\n")
    .filter((line) => line.endsWith(`→ ${reason}`)).length;

/** The app leaves now, and a return checks once the away rule allows it. */
const returnAfter = async (awayMs: number) => {
  emitAppState(APP_STATE.BACKGROUND);
  loaded.markAppLeft(Date.now());
  await jest.advanceTimersByTimeAsync(awayMs);
  emitAppState(APP_STATE.ACTIVE);
};

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
  mockGetPermissions.mockResolvedValue({
    status: LocalPermissionStatus.GRANTED,
    granted: true,
    canAskAgain: true,
  });
  mockServicesEnabled.mockResolvedValue(true);
  mockLastKnown.mockResolvedValue(null);
  mockCurrentPosition.mockImplementation(async () => fixAt(MAKKAH));
  mockReverseGeocode.mockResolvedValue([]);
  mockFindNearestCity.mockResolvedValue(null);
  mockFullPack.mockReturnValue(false);
  mockPhoneZone.mockReturnValue(RIYADH_ZONE);
  await load();
});
afterEach(() => jest.useRealTimers());

describe("offer", () => {
  it("offers Jeddah to a Makkah user after two agreeing fixes 30 s apart", async () => {
    freshFixes(JEDDAH, JEDDAH_2);
    rowNear(JEDDAH_ROW);

    await check();

    expect(location().cityOffer).toEqual({
      candidate: expect.objectContaining({
        name: { name: "Jeddah", names: JEDDAH_ROW.names },
        zone: "Asia/Riyadh",
      }),
      reasons: [CITY_CHECK_OFFER.SHIFT],
    });
    expect(mockCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("hands a second caller the running check", async () => {
    const a = loaded.runCityCheck(LAUNCH);
    expect(loaded.runCityCheck(RETURN)).toBe(a);
    await settle(a);
  });

  it("calls the device geocoder only when the verdict needs a country or the offer needs a name", async () => {
    freshFixes(JEDDAH, JEDDAH_2);
    rowNear(JEDDAH_ROW);

    await check();

    expect(location().cityOffer).not.toBeNull();
    expect(mockReverseGeocode).not.toHaveBeenCalled();
  });

  it("names an unnamed candidate from the device geocoder", async () => {
    freshFixes(JEDDAH, JEDDAH_2);
    mockReverseGeocode.mockResolvedValue([address({ city: "Jeddah" })]);

    await check();

    expect(location().cityOffer?.candidate).toEqual(
      expect.objectContaining({ name: { name: "Jeddah", names: null }, zone: null })
    );
    expect(mockReverseGeocode).toHaveBeenCalledTimes(1);
  });

  it("offers an unnamed candidate when the device geocoder fails", async () => {
    freshFixes(JEDDAH, JEDDAH_2);
    mockReverseGeocode.mockRejectedValue(new Error("geocoder"));

    await check();

    expect(location().cityOffer?.candidate).toEqual(
      expect.objectContaining({ name: null, zone: null })
    );
  });

  it("takes the country from the full pack when it is installed", async () => {
    await load(KHOBAR);
    mockFullPack.mockReturnValue(true);
    freshFixes(MANAMA, MANAMA);
    rowNear(MANAMA_ROW);

    await check();

    expect(location().cityOffer?.candidate.countryCode).toBe(BAHRAIN);
    expect(location().cityOffer?.reasons).toContain(CITY_CHECK_OFFER.COUNTRY_CHANGES);
    expect(mockReverseGeocode).not.toHaveBeenCalled();
  });

  it("remembers the saved place's country once it is looked up", async () => {
    await load(DAMMAM, null);
    freshFixes(KHOBAR, KHOBAR);
    mockReverseGeocode.mockResolvedValue([address({ isoCountryCode: "sa" })]);

    await check();

    expect(location().locationDetails.countryCode).toBe(SA);
    expect(location().cityOffer).toBeNull();
    ended(LAUNCH, CITY_CHECK_END.SHIFT_BELOW_GATE);
    expect(mockReverseGeocode).toHaveBeenCalledTimes(2);
  });

  it("logs reason codes without names or coordinates", async () => {
    freshFixes(JEDDAH, JEDDAH_2);
    rowNear(JEDDAH_ROW);

    await check();

    expect(location().cityOffer).not.toBeNull();
    expect(allLogText()).toContain(`${LAUNCH} → offer (${CITY_CHECK_OFFER.SHIFT})`);
    expect(allLogText()).not.toMatch(/Jeddah|Makkah|21\.[45]|39\.[18]/);
  });
});

describe("reads", () => {
  it("never asks for permission", async () => {
    mockGetPermissions.mockResolvedValue({
      status: LocalPermissionStatus.DENIED,
      granted: false,
      canAskAgain: true,
    });

    await check();

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockCurrentPosition).not.toHaveBeenCalled();
    expect(location().cityOffer).toBeNull();
    ended(LAUNCH, CITY_CHECK_END.NO_PERMISSION);
  });

  it("never opens the location settings dialog", async () => {
    freshFixes(JEDDAH, JEDDAH_2);

    await check();

    expect(mockCurrentPosition).toHaveBeenCalledTimes(2);
    for (const [options] of mockCurrentPosition.mock.calls)
      expect(options).toEqual(expect.objectContaining({ mayShowUserSettingsDialog: false }));
  });

  it("ends quietly when location services are off", async () => {
    mockCurrentPosition.mockRejectedValue(new Error("services off"));
    mockServicesEnabled.mockResolvedValue(false);

    await check();

    expect(location().cityOffer).toBeNull();
    ended(LAUNCH, CITY_CHECK_END.SERVICES_OFF);
  });

  it("ends on a failed fix", async () => {
    mockCurrentPosition.mockRejectedValue(new Error("no fix"));

    await check();

    ended(LAUNCH, CITY_CHECK_END.FIX_FAILED);
  });

  it("stops on a cached fix near the saved place with no fresh fix", async () => {
    mockLastKnown.mockResolvedValue(fixAt(MAKKAH_2, NOW - MINUTE_MS));

    await check();

    expect(mockCurrentPosition).not.toHaveBeenCalled();
    ended(LAUNCH, CITY_CHECK_END.NOT_MOVED);
  });

  it("takes a fresh fix over a cached one far from the saved place", async () => {
    mockLastKnown.mockResolvedValue(fixAt(JEDDAH, NOW - MINUTE_MS));
    freshFixes(MAKKAH);

    await check();

    expect(mockCurrentPosition).toHaveBeenCalledTimes(1);
    ended(LAUNCH, CITY_CHECK_END.NOT_MOVED);
  });

  it("makes no offer for a phone zone that differs from the place's zone", async () => {
    mockPhoneZone.mockReturnValue(DUBAI_ZONE);
    freshFixes(MAKKAH);

    await check();

    expect(location().cityOffer).toBeNull();
    ended(LAUNCH, CITY_CHECK_END.NOT_MOVED);
  });
});

describe("confirmation", () => {
  it("confirms on the next return when the app leaves before the second fix", async () => {
    freshFixes(JEDDAH, JEDDAH_2);
    rowNear(JEDDAH_ROW);
    const first = loaded.runCityCheck(LAUNCH);
    await jest.advanceTimersByTimeAsync(SECOND_MS);
    emitAppState(APP_STATE.BACKGROUND);
    loaded.markAppLeft(Date.now());
    await first;

    expect(location().cityOffer).toBeNull();
    expect(memory().lastCheckAt).toBeNull();
    ended(LAUNCH, CITY_CHECK_END.CONFIRM_DEFERRED);

    await jest.advanceTimersByTimeAsync(MINUTE_MS);
    emitAppState(APP_STATE.ACTIVE);
    await check(RETURN);

    expect(location().cityOffer).not.toBeNull();
  });

  it("defers when the second read returns the first fix again", async () => {
    const same = fixAt(JEDDAH, NOW);
    mockCurrentPosition.mockResolvedValue(same);

    await check();

    expect(location().cityOffer).toBeNull();
    expect(endCount(CITY_CHECK_END.CONFIRM_DEFERRED)).toBe(1);
    expect(memory().lastCheckAt).toBeNull();
    await jest.advanceTimersByTimeAsync(CONFIRM_FIX_DELAY_MS * 4);
    expect(mockCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("confirms a deferred fix on the next return", async () => {
    mockCurrentPosition.mockResolvedValue(fixAt(JEDDAH, NOW));
    rowNear(JEDDAH_ROW);
    await check();

    await jest.advanceTimersByTimeAsync(MINUTE_MS);
    mockCurrentPosition.mockResolvedValue(fixAt(JEDDAH_2, NOW + 2 * MINUTE_MS));
    await check(RETURN);

    expect(location().cityOffer).not.toBeNull();
    expect(mockCurrentPosition).toHaveBeenCalledTimes(3);
  });
});

describe("memory", () => {
  it("waits for the city-check memory to load before it judges", async () => {
    loaded.memory.setState({
      cityCheck: { ...memory(), notAsked: [toPlaceMark(JEDDAH, NOW - DAY_MS)] },
    });
    const hold = holdHydration(loaded.memory);
    freshFixes(JEDDAH, JEDDAH_2);

    const run = loaded.runCityCheck(LAUNCH);
    await jest.advanceTimersByTimeAsync(SECOND_MS);
    expect(mockCurrentPosition).not.toHaveBeenCalled();
    hold.land();
    await settle(run);

    expect(location().cityOffer).toBeNull();
    expect(mockCurrentPosition).toHaveBeenCalledTimes(1);
    ended(LAUNCH, CITY_CHECK_END.NOT_ASKED);
  });

  it("ends with no write when the memory does not load in time", async () => {
    holdHydration(loaded.memory);

    const run = loaded.runCityCheck(LAUNCH);
    await jest.advanceTimersByTimeAsync(MEMORY_LOAD_TIMEOUT_MS);
    await run;

    ended(LAUNCH, CITY_CHECK_SKIP.MEMORY_NOT_LOADED);
    expect(memory().lastCheckAt).toBeNull();
    expect(memory().lastPhoneZone).toBeNull();
    expect(mockLastKnown).not.toHaveBeenCalled();
    expect(mockCurrentPosition).not.toHaveBeenCalled();
  });

  it("records the check time and the phone zone", async () => {
    await check();

    expect(memory().lastCheckAt).toBe(NOW);
    expect(memory().lastPhoneZone).toBe(RIYADH_ZONE);
  });

  it("records nothing for a check its guards skipped", async () => {
    location().setTravelMode(TRAVEL_MODE.OFF);

    await check();

    expect(memory().lastCheckAt).toBeNull();
    expect(memory().lastPhoneZone).toBeNull();
    expect(mockCurrentPosition).not.toHaveBeenCalled();
    ended(LAUNCH, CITY_CHECK_SKIP.TRAVEL_OFF);
  });

  it("keeps the kept trip on one fresh fix at home and ends it on a confirmed pair", async () => {
    const trip = toPlaceMark(JEDDAH, NOW - DAY_MS, SA);
    loaded.memory.setState({ cityCheck: { ...memory(), kept: [trip] } });
    mockLastKnown.mockResolvedValue(fixAt(MAKKAH, NOW - MINUTE_MS));
    mockCurrentPosition.mockResolvedValue(fixAt(MAKKAH, NOW));

    const first = loaded.runCityCheck(LAUNCH);
    await jest.advanceTimersByTimeAsync(SECOND_MS);
    expect(mockCurrentPosition).toHaveBeenCalledTimes(1);
    emitAppState(APP_STATE.BACKGROUND);
    await first;

    ended(LAUNCH, CITY_CHECK_END.CONFIRM_DEFERRED);
    expect(memory().kept).toEqual([trip]);

    await jest.advanceTimersByTimeAsync(MINUTE_MS);
    emitAppState(APP_STATE.ACTIVE);
    mockCurrentPosition.mockResolvedValue(fixAt(MAKKAH_2, NOW + CONFIRM_FIX_DELAY_MS));
    await check(RETURN);

    expect(memory().kept).toEqual([]);
    ended(RETURN, CITY_CHECK_END.NOT_MOVED);
  });

  it("offers again on a second trip after a confirmed pair at home ended the first", async () => {
    loaded.memory.setState({
      cityCheck: { ...memory(), kept: [toPlaceMark(JEDDAH, NOW - DAY_MS, SA)] },
    });
    freshFixes(MAKKAH, MAKKAH_2);
    await check();

    expect(memory().kept).toEqual([]);
    ended(LAUNCH, CITY_CHECK_END.NOT_MOVED);

    freshFixes(JEDDAH, JEDDAH_2);
    rowNear(JEDDAH_ROW);
    await returnAfter(CHECK_THROTTLE_MS + MINUTE_MS);
    await check(RETURN);

    expect(location().cityOffer).not.toBeNull();
  });

  it("ends at a kept place on its first fresh fix", async () => {
    loaded.memory.setState({
      cityCheck: { ...memory(), kept: [toPlaceMark(JEDDAH, NOW - DAY_MS, SA)] },
    });
    freshFixes(JEDDAH, JEDDAH_2);

    await check();

    expect(mockCurrentPosition).toHaveBeenCalledTimes(1);
    expect(location().cityOffer).toBeNull();
    ended(LAUNCH, CITY_CHECK_END.KEPT);
  });
});

describe("during the check", () => {
  /** Runs `change` inside a Jeddah check's second-fix wait. */
  const changeDuringWait = async (change: () => void) => {
    freshFixes(JEDDAH, JEDDAH_2);
    rowNear(JEDDAH_ROW);
    const run = loaded.runCityCheck(LAUNCH);
    await jest.advanceTimersByTimeAsync(SECOND_MS);
    change();
    await settle(run);
    expect(location().cityOffer).toBeNull();
  };

  it("makes no offer when the saved place changes during the check", async () => {
    await changeDuringWait(() =>
      loaded.location.setState({ placeRevision: location().placeRevision + 1 })
    );
    ended(LAUNCH, CITY_CHECK_END.PLACE_CHANGED);
  });

  it("makes no offer when an update starts during the check", async () => {
    await changeDuringWait(() => {
      void loaded.update.getState().withRun({ kind: UPDATE_START.DEVICE }, () => never());
    });
    ended(LAUNCH, CITY_CHECK_SKIP.UPDATE_RUNNING);
  });

  it("makes no offer when travel is turned off during the check", async () => {
    await changeDuringWait(() => location().setTravelMode(TRAVEL_MODE.OFF));
    ended(LAUNCH, CITY_CHECK_SKIP.TRAVEL_OFF);
  });
});

describe("triggers", () => {
  it("drops an offer whose fix is 30 minutes old and checks again", async () => {
    location().offerCity(candidateAt({ fixedAt: NOW - CHECK_THROTTLE_MS }), [
      CITY_CHECK_OFFER.SHIFT,
    ]);
    mockLastKnown.mockResolvedValue(fixAt(MAKKAH, NOW));
    await returnAfter(CHECK_MIN_AWAY_MS + MINUTE_MS);

    await check(RETURN);

    expect(location().cityOffer).toBeNull();
    ended(RETURN, CITY_CHECK_END.NOT_MOVED);
  });

  it("keeps an offer that is still fresh", async () => {
    location().offerCity(candidateAt({ fixedAt: NOW }), [CITY_CHECK_OFFER.SHIFT]);

    await check();

    expect(location().cityOffer).not.toBeNull();
    ended(LAUNCH, CITY_CHECK_SKIP.OFFER_SHOWING);
  });

  it("skips a return after a short time away", async () => {
    await returnAfter(MINUTE_MS);

    await check(RETURN);

    ended(RETURN, CITY_CHECK_SKIP.AWAY_TOO_SHORT);
    expect(mockLastKnown).not.toHaveBeenCalled();
  });

  it("takes no fix when the app was launched in the background, and checks at the first activation", async () => {
    setAppState(APP_STATE.BACKGROUND);
    await check(LAUNCH);

    ended(LAUNCH, CITY_CHECK_SKIP.APP_NOT_ACTIVE);
    expect(mockLastKnown).not.toHaveBeenCalled();
    expect(mockCurrentPosition).not.toHaveBeenCalled();

    emitAppState(APP_STATE.ACTIVE);
    freshFixes(JEDDAH, JEDDAH_2);
    rowNear(JEDDAH_ROW);
    await check(RETURN);

    expect(location().cityOffer).not.toBeNull();
  });
});
