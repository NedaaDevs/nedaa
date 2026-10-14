import { AppState, AppStateStatus } from "react-native";

import { LocationMode, type LocationModeValue } from "@/enums/location";

// The `mock` prefix satisfies the factory hoisting rule; the factories read these lazily.
const mockRescheduleIfNeeded = jest.fn();
const mockRefreshTimings = jest.fn();
const mockSyncWidgetSnapshot = jest.fn();

jest.mock("@/services/widgetSnapshot", () => ({
  syncWidgetSnapshot: () => mockSyncWidgetSnapshot(),
}));
const mockEnsureAlarms = jest.fn();
const mockWaitForAlarmStores = jest.fn();
const mockLogError = jest.fn();
const mockLoadPrayerTimes = jest.fn();
const mockCheckPermission = jest.fn();
const mockLocationState: {
  locationMode: LocationModeValue;
  lastKnownCoords: { latitude: number; longitude: number } | null;
} = {
  locationMode: LocationMode.DEVICE,
  lastKnownCoords: null,
};
const mockPrayerTimesState = {
  didGetCurrentLocation: true,
  usingDefaultLocation: false,
  loadingTimes: false,
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
    }),
  },
}));
jest.mock("@/stores/location", () => ({
  useLocationStore: { getState: () => ({ ...mockLocationState }) },
}));
jest.mock("@/utils/location", () => ({ checkLocationPermission: mockCheckPermission }));
jest.mock("@/utils/alarmScheduler", () => ({
  ensureAlarmsScheduled: mockEnsureAlarms,
  waitForAlarmStores: mockWaitForAlarmStores,
}));
jest.mock("@/utils/appLogger", () => ({ AppLogger: { create: () => ({ e: mockLogError }) } }));

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
  mockWaitForAlarmStores.mockClear().mockResolvedValue(undefined);
  mockLogError.mockClear();
  mockLoadPrayerTimes.mockClear().mockResolvedValue(undefined);
  mockCheckPermission.mockClear().mockResolvedValue({ granted: true });
  // A verified fix in hand, so the repair gate is shut.
  mockPrayerTimesState.didGetCurrentLocation = true;
  mockPrayerTimesState.usingDefaultLocation = false;
  mockPrayerTimesState.loadingTimes = false;
  mockLocationState.locationMode = LocationMode.DEVICE;
  mockLocationState.lastKnownCoords = { latitude: 24.7136, longitude: 46.6753 };
  mockSyncWidgetSnapshot.mockClear().mockResolvedValue(undefined);
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

  it("refreshes the window before it tops up the horizon", async () => {
    const handler = registerFresh();

    handler("active");
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

    handler("active");
    await settle();

    expect(mockEnsureAlarms).toHaveBeenCalledTimes(1);
    expect(mockRefreshTimings.mock.invocationCallOrder[0]).toBeLessThan(
      mockEnsureAlarms.mock.invocationCallOrder[0]
    );
  });

  // The reschedule rewrites every pending notification; a short foreground can end inside it.
  it("arms the alarms before the notification reschedule", async () => {
    const handler = registerFresh();

    handler("active");
    await settle();

    expect(mockEnsureAlarms.mock.invocationCallOrder[0]).toBeLessThan(
      mockRescheduleIfNeeded.mock.invocationCallOrder[0]
    );
  });

  // Unhydrated stores read as disabled, so the top-up would arm nothing.
  it("waits for alarm hydration before it tops up", async () => {
    const handler = registerFresh();

    handler("active");
    await settle();

    expect(mockWaitForAlarmStores.mock.invocationCallOrder[0]).toBeLessThan(
      mockEnsureAlarms.mock.invocationCallOrder[0]
    );
  });

  it("still arms the alarms when the timings refresh throws", async () => {
    mockRefreshTimings.mockRejectedValue(new Error("db closed"));
    const handler = registerFresh();

    handler("active");
    await settle();

    expect(mockEnsureAlarms).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalled();
  });

  it("still reschedules when the alarm top-up throws", async () => {
    mockEnsureAlarms.mockRejectedValue(new Error("native refused"));
    const handler = registerFresh();

    handler("active");
    await settle();

    expect(mockRescheduleIfNeeded).toHaveBeenCalledWith(false);
  });

  // Stored rows carry no location, so only a forced refetch replaces the old city's times.
  it("forces a refetch when a device fix can replace default-location times", async () => {
    withDefaultLocationTimes();
    const handler = registerFresh();

    handler("active");
    await settle();

    expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
    expect(mockRefreshTimings).not.toHaveBeenCalled();
  });

  it("repairs the location at most once per process", async () => {
    withDefaultLocationTimes();
    const handler = registerFresh();

    handler("active");
    await settle();
    handler("active");
    await settle();

    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(1);
  });

  it("only re-reads when a verified fix is already in hand", async () => {
    const handler = registerFresh();

    handler("active");
    await settle();

    expect(mockLoadPrayerTimes).not.toHaveBeenCalled();
    expect(mockRefreshTimings).toHaveBeenCalledTimes(1);
  });

  it("leaves a manually picked location alone", async () => {
    withDefaultLocationTimes();
    mockLocationState.locationMode = LocationMode.MANUAL;
    const handler = registerFresh();

    handler("active");
    await settle();

    expect(mockLoadPrayerTimes).not.toHaveBeenCalled();
    expect(mockRefreshTimings).toHaveBeenCalledTimes(1);
  });

  it("does not repair while the permission is still denied", async () => {
    withDefaultLocationTimes();
    mockCheckPermission.mockResolvedValue({ granted: false });
    const handler = registerFresh();

    handler("active");
    await settle();

    expect(mockLoadPrayerTimes).not.toHaveBeenCalled();
  });

  it("refetches for a verified place whose own rows have not landed", async () => {
    withVerifiedPlaceAwaitingRows();
    mockLocationState.locationMode = LocationMode.MANUAL;
    mockCheckPermission.mockResolvedValue({ granted: false });
    const handler = registerFresh();

    handler("active");
    await settle();

    expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
    expect(mockRefreshTimings).not.toHaveBeenCalled();
  });

  // A dead network would otherwise refetch the year on every foreground.
  it("refetches for that place at most once per process", async () => {
    withVerifiedPlaceAwaitingRows();
    mockLoadPrayerTimes.mockRejectedValue(new Error("offline"));
    const handler = registerFresh();

    handler("active");
    await settle();
    handler("active");
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

    handler("active");
    await settle();
    expect(mockLoadPrayerTimes).not.toHaveBeenCalled();
    expect(mockRefreshTimings).toHaveBeenCalledTimes(1);

    mockPrayerTimesState.loadingTimes = false;
    handler("active");
    await settle();
    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(1);
    expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
  });

  it("does nothing when the app backgrounds", async () => {
    const handler = registerFresh();

    handler("background");
    await settle();

    expect(mockRefreshTimings).not.toHaveBeenCalled();
    expect(mockRescheduleIfNeeded).not.toHaveBeenCalled();
    expect(mockSyncWidgetSnapshot).not.toHaveBeenCalled();
    expect(mockEnsureAlarms).not.toHaveBeenCalled();
  });
});
