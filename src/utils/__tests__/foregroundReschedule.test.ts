import { AppState, AppStateStatus } from "react-native";

import { APP_STATE } from "@/constants/AppState";
import { CITY_CHECK_TRIGGER } from "@/constants/CityCheck";
import { ALARM_HYDRATION_TIMEOUT_MS } from "@/constants/Alarm";
import { LocationMode, type LocationModeValue } from "@/enums/location";
import type { Coords } from "@/types/location";

// The `mock` prefix satisfies the factory hoisting rule; the factories read these lazily.
const mockRescheduleIfNeeded = jest.fn();
const mockRefreshTimings = jest.fn();
const mockSyncWidgetSnapshot = jest.fn();

jest.mock("@/services/widgetSnapshot", () => ({
  syncWidgetSnapshot: () => mockSyncWidgetSnapshot(),
}));
const mockRunCityCheck = jest.fn();
const mockMarkAppLeft = jest.fn();
jest.mock("@/services/cityCheck", () => ({
  runCityCheck: (trigger: string) => mockRunCityCheck(trigger),
  markAppLeft: (at: number) => mockMarkAppLeft(at),
}));
const mockEnsureAlarms = jest.fn();
const mockRescheduleAlarms = jest.fn();
const mockWaitForAlarmStores = jest.fn();
const mockLogError = jest.fn();
const mockLoadPrayerTimes = jest.fn();
const mockCheckPermission = jest.fn();
const mockLocationState: {
  locationMode: LocationModeValue;
  lastKnownCoords: Coords | null;
  locationDetails: { coords: Coords };
} = {
  locationMode: LocationMode.DEVICE,
  lastKnownCoords: null,
  locationDetails: { coords: { latitude: 24.7136, longitude: 46.6753 } },
};
const mockPrayerTimesState: {
  didGetCurrentLocation: boolean;
  usingDefaultLocation: boolean;
  loadingTimes: boolean;
  timesCoords: Coords | null;
} = {
  didGetCurrentLocation: true,
  usingDefaultLocation: false,
  loadingTimes: false,
  timesCoords: null,
};
/** Both stores' disk read: whether it has landed, and who waits for it. */
const mockHydration = { landed: true, listeners: [] as (() => void)[] };
const mockPersist = {
  hasHydrated: () => mockHydration.landed,
  onHydrate: () => () => {},
  onFinishHydration: (listener: () => void) => {
    mockHydration.listeners.push(listener);
    return () => {};
  },
};

jest.mock("@/stores/notification", () => ({
  useNotificationStore: {
    getState: () => ({ rescheduleIfNeeded: mockRescheduleIfNeeded }),
  },
}));
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: {
    getState: () => ({
      refreshTimingsFromDb: mockRefreshTimings,
      loadPrayerTimes: mockLoadPrayerTimes,
      didGetCurrentLocation: mockPrayerTimesState.didGetCurrentLocation,
      usingDefaultLocation: mockPrayerTimesState.usingDefaultLocation,
      loadingTimes: mockPrayerTimesState.loadingTimes,
      timesCoords: mockPrayerTimesState.timesCoords,
    }),
    persist: mockPersist,
  },
}));
jest.mock("@/stores/location", () => ({
  useLocationStore: { getState: () => ({ ...mockLocationState }), persist: mockPersist },
}));
jest.mock("@/utils/location", () => ({ checkLocationPermission: mockCheckPermission }));
jest.mock("@/utils/alarmScheduler", () => ({
  ensureAlarmsScheduled: mockEnsureAlarms,
  rescheduleAllAlarms: mockRescheduleAlarms,
  waitForAlarmStores: mockWaitForAlarmStores,
}));
jest.mock("@/utils/appLogger", () => ({ AppLogger: { create: () => ({ e: mockLogError }) } }));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { w: jest.fn() } }));

// The module's `registered` flag means each test needs its own copy.
const loadFresh = (): (() => void) => {
  let register!: () => void;
  jest.isolateModules(() => {
    // A static import hoists out of the callback; isolateModules needs a call-time require.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    register = require("@/utils/foregroundReschedule").registerForegroundReschedule;
  });
  return register;
};

/** Registers a fresh copy and hands back the listener it subscribed. */
const registerFresh = (): ((state: AppStateStatus) => void) => {
  const addListener = jest.spyOn(AppState, "addEventListener");
  loadFresh()();
  return addListener.mock.calls[addListener.mock.calls.length - 1][1];
};

const settle = () => new Promise(process.nextTick);

beforeEach(() => {
  jest.restoreAllMocks();
  mockRefreshTimings.mockClear().mockResolvedValue([]);
  mockRescheduleIfNeeded.mockClear().mockResolvedValue(undefined);
  mockEnsureAlarms.mockClear().mockResolvedValue(undefined);
  mockRescheduleAlarms.mockClear().mockResolvedValue(undefined);
  mockWaitForAlarmStores.mockClear().mockResolvedValue(undefined);
  mockLogError.mockClear();
  mockRunCityCheck.mockClear().mockReturnValue(Promise.resolve());
  mockMarkAppLeft.mockClear();
  mockLoadPrayerTimes.mockClear().mockResolvedValue(undefined);
  mockCheckPermission.mockClear().mockResolvedValue({ granted: true });
  // A verified fix in hand, so the repair gate is shut.
  mockPrayerTimesState.didGetCurrentLocation = true;
  mockPrayerTimesState.usingDefaultLocation = false;
  mockPrayerTimesState.loadingTimes = false;
  mockPrayerTimesState.timesCoords = { latitude: 24.7136, longitude: 46.6753 };
  mockLocationState.locationMode = LocationMode.DEVICE;
  mockLocationState.lastKnownCoords = { latitude: 24.7136, longitude: 46.6753 };
  mockLocationState.locationDetails = { coords: { latitude: 24.7136, longitude: 46.6753 } };
  mockSyncWidgetSnapshot.mockClear().mockResolvedValue(undefined);
  mockHydration.landed = true;
  mockHydration.listeners = [];
});

/** The state a user leaves by granting location in the settings app. */
const withDefaultLocationTimes = () => {
  mockPrayerTimesState.didGetCurrentLocation = false;
  mockPrayerTimesState.usingDefaultLocation = true;
  mockLocationState.lastKnownCoords = null;
};

/** A verified place whose fetch failed: the default rows still stand. */
const withVerifiedPlaceAwaitingRows = () => {
  mockPrayerTimesState.usingDefaultLocation = true;
};

describe("registerForegroundReschedule", () => {
  it("registers only once", () => {
    const addListener = jest.spyOn(AppState, "addEventListener");
    const register = loadFresh();
    register();
    register();

    expect(addListener).toHaveBeenCalledTimes(1);
  });

  it("starts the city check at each return without waiting for it", async () => {
    mockRunCityCheck.mockReturnValue(new Promise(() => {}));
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockRunCityCheck).toHaveBeenCalledWith(CITY_CHECK_TRIGGER.RETURN);
    expect(mockRunCityCheck.mock.invocationCallOrder[0]).toBeLessThan(
      mockRefreshTimings.mock.invocationCallOrder[0]
    );
    expect(mockRescheduleIfNeeded).toHaveBeenCalled();
  });

  it("records the time the app leaves for the background", () => {
    jest.spyOn(Date, "now").mockReturnValue(1234);
    const handler = registerFresh();

    handler(APP_STATE.INACTIVE);
    expect(mockMarkAppLeft).not.toHaveBeenCalled();
    handler(APP_STATE.BACKGROUND);

    expect(mockMarkAppLeft).toHaveBeenCalledWith(1234);
    expect(mockRunCityCheck).not.toHaveBeenCalled();
  });

  it("refreshes the window before it tops up the horizon", async () => {
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockRescheduleIfNeeded).toHaveBeenCalledWith(false);
    expect(mockSyncWidgetSnapshot).toHaveBeenCalledTimes(1);
    expect(mockRefreshTimings.mock.invocationCallOrder[0]).toBeLessThan(
      mockSyncWidgetSnapshot.mock.invocationCallOrder[0]
    );
    expect(mockSyncWidgetSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      mockRescheduleIfNeeded.mock.invocationCallOrder[0]
    );
    // The window refresh must precede the reschedule.
    expect(mockRefreshTimings.mock.invocationCallOrder[0]).toBeLessThan(
      mockRescheduleIfNeeded.mock.invocationCallOrder[0]
    );
  });

  // schedulePrayerAlarm and getFridayDhuhrCandidates read the refreshed window.
  it("tops up the alarms from the refreshed window", async () => {
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockEnsureAlarms).toHaveBeenCalledTimes(1);
    expect(mockRefreshTimings.mock.invocationCallOrder[0]).toBeLessThan(
      mockEnsureAlarms.mock.invocationCallOrder[0]
    );
  });

  // The reschedule rewrites every pending notification; a short foreground can end inside it.
  it("arms the alarms before the notification reschedule", async () => {
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockEnsureAlarms.mock.invocationCallOrder[0]).toBeLessThan(
      mockRescheduleIfNeeded.mock.invocationCallOrder[0]
    );
  });

  // Unhydrated stores read as disabled, so the top-up would arm nothing.
  it("waits for alarm hydration before it tops up", async () => {
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockWaitForAlarmStores.mock.invocationCallOrder[0]).toBeLessThan(
      mockEnsureAlarms.mock.invocationCallOrder[0]
    );
  });

  it("still arms the alarms when the timings refresh throws", async () => {
    mockRefreshTimings.mockRejectedValue(new Error("db closed"));
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockEnsureAlarms).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalled();
  });

  it("still reschedules when the alarm top-up throws", async () => {
    mockEnsureAlarms.mockRejectedValue(new Error("native refused"));
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockRescheduleIfNeeded).toHaveBeenCalledWith(false);
  });

  // Stored rows carry no location, so only a forced refetch replaces the old city's times.
  it("forces a refetch when a device fix can replace default-location times", async () => {
    withDefaultLocationTimes();
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
    expect(mockRefreshTimings).not.toHaveBeenCalled();
  });

  it("repairs the location at most once per process", async () => {
    withDefaultLocationTimes();
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();
    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(1);
  });

  it("only re-reads when a verified fix is already in hand", async () => {
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockLoadPrayerTimes).not.toHaveBeenCalled();
    expect(mockRefreshTimings).toHaveBeenCalledTimes(1);
  });

  // A run that failed at the times leaves the new place over the old days.
  it("refetches for a verified place whose days were fetched elsewhere", async () => {
    mockLocationState.locationDetails = { coords: { latitude: 21.4858, longitude: 39.1925 } };
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
    expect(mockRefreshTimings).not.toHaveBeenCalled();
  });

  // The top-up keeps an armed alarm; only a reschedule moves it.
  it("moves the alarms once a repair brings the times to the saved place", async () => {
    mockLocationState.locationDetails = { coords: { latitude: 21.4858, longitude: 39.1925 } };
    mockLoadPrayerTimes.mockImplementation(async () => {
      mockPrayerTimesState.timesCoords = mockLocationState.locationDetails.coords;
      return true;
    });
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockWaitForAlarmStores).toHaveBeenCalled();
    expect(mockRescheduleAlarms).toHaveBeenCalledTimes(1);
    expect(mockEnsureAlarms).not.toHaveBeenCalled();
  });

  it("only tops up the alarms when the repair leaves the times elsewhere", async () => {
    mockLocationState.locationDetails = { coords: { latitude: 21.4858, longitude: 39.1925 } };
    mockLoadPrayerTimes.mockRejectedValue(new Error("offline"));
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockRescheduleAlarms).not.toHaveBeenCalled();
    expect(mockEnsureAlarms).toHaveBeenCalledTimes(1);
  });

  it("leaves a manually picked location alone", async () => {
    withDefaultLocationTimes();
    mockLocationState.locationMode = LocationMode.MANUAL;
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockLoadPrayerTimes).not.toHaveBeenCalled();
    expect(mockRefreshTimings).toHaveBeenCalledTimes(1);
  });

  it("does not repair while the permission is still denied", async () => {
    withDefaultLocationTimes();
    mockCheckPermission.mockResolvedValue({ granted: false });
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockLoadPrayerTimes).not.toHaveBeenCalled();
  });

  it("refetches for a verified place whose own rows have not landed", async () => {
    withVerifiedPlaceAwaitingRows();
    mockLocationState.locationMode = LocationMode.MANUAL;
    mockCheckPermission.mockResolvedValue({ granted: false });
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
    expect(mockRefreshTimings).not.toHaveBeenCalled();
  });

  // Before the disk read lands, the stores hold their defaults, not the place.
  it("reads the place once the stores load", async () => {
    mockHydration.landed = false;
    mockPrayerTimesState.usingDefaultLocation = false;
    mockLocationState.lastKnownCoords = null;
    mockLocationState.locationMode = LocationMode.MANUAL;
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();
    withVerifiedPlaceAwaitingRows();
    mockLocationState.lastKnownCoords = { latitude: 24.7136, longitude: 46.6753 };
    mockHydration.landed = true;
    mockHydration.listeners.forEach((listener) => listener());
    await settle();

    expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
  });

  // Unloaded stores hold defaults, not the place: no repair, and the retry stays.
  it("repairs nothing while the stores have not loaded, keeping its retry", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick"] });
    try {
      mockHydration.landed = false;
      withDefaultLocationTimes();
      const handler = registerFresh();

      handler(APP_STATE.ACTIVE);
      await jest.advanceTimersByTimeAsync(ALARM_HYDRATION_TIMEOUT_MS);
      expect(mockLoadPrayerTimes).not.toHaveBeenCalled();
      expect(mockRefreshTimings).toHaveBeenCalledTimes(1);

      mockHydration.landed = true;
      mockHydration.listeners.forEach((listener) => listener());
      handler(APP_STATE.ACTIVE);
      await jest.advanceTimersByTimeAsync(0);
      expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
    } finally {
      jest.useRealTimers();
    }
  });

  // A dead network would otherwise refetch the year on every foreground.
  it("refetches for that place at most once per process", async () => {
    withVerifiedPlaceAwaitingRows();
    mockLoadPrayerTimes.mockRejectedValue(new Error("offline"));
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();
    handler(APP_STATE.ACTIVE);
    await settle();

    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(1);
    expect(mockRefreshTimings).toHaveBeenCalledTimes(1);
  });

  // The running load owns the outcome; a second one would only duplicate it.
  it.each([
    ["a verified place awaiting its rows", withVerifiedPlaceAwaitingRows],
    ["default times a device fix can replace", withDefaultLocationTimes],
  ])("skips the repair for %s while a load runs, keeping its retry", async (_name, arrange) => {
    arrange();
    mockPrayerTimesState.loadingTimes = true;
    const handler = registerFresh();

    handler(APP_STATE.ACTIVE);
    await settle();
    expect(mockLoadPrayerTimes).not.toHaveBeenCalled();
    expect(mockRefreshTimings).toHaveBeenCalledTimes(1);

    mockPrayerTimesState.loadingTimes = false;
    handler(APP_STATE.ACTIVE);
    await settle();
    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(1);
    expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
  });

  it("does nothing when the app backgrounds", async () => {
    const handler = registerFresh();

    handler(APP_STATE.BACKGROUND);
    await settle();

    expect(mockRefreshTimings).not.toHaveBeenCalled();
    expect(mockRescheduleIfNeeded).not.toHaveBeenCalled();
    expect(mockSyncWidgetSnapshot).not.toHaveBeenCalled();
    expect(mockEnsureAlarms).not.toHaveBeenCalled();
  });
});
