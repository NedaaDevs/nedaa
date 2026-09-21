import { AppState, AppStateStatus } from "react-native";

// Referenced lazily by the module factories below, so the `mock` prefix hoisting
// rule is satisfied and the consts are initialised before any test calls them.
const mockRescheduleIfNeeded = jest.fn();
const mockRefreshTimings = jest.fn();
const mockSyncWidgetSnapshot = jest.fn();

jest.mock("@/services/widgetSnapshot", () => ({
  syncWidgetSnapshot: () => mockSyncWidgetSnapshot(),
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ e: jest.fn() }) },
}));
const mockEnsureAlarms = jest.fn();

jest.mock("@/stores/notification", () => ({
  useNotificationStore: {
    getState: () => ({ rescheduleIfNeeded: mockRescheduleIfNeeded }),
  },
}));
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: {
    getState: () => ({ refreshTimingsFromDb: mockRefreshTimings }),
  },
}));
jest.mock("@/utils/alarmScheduler", () => ({ ensureAlarmsScheduled: mockEnsureAlarms }));

// The module guards itself with a `registered` flag, so each test needs its own copy
// to observe the registration.
const registerFresh = (): ((state: AppStateStatus) => void) => {
  const addListener = jest.spyOn(AppState, "addEventListener");
  let register!: () => void;
  jest.isolateModules(() => {
    // A static import is hoisted out of the callback, so isolateModules needs a call-time require
    // to load the module afresh.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    register = require("@/utils/foregroundReschedule").registerForegroundReschedule;
  });
  register();
  return addListener.mock.calls[addListener.mock.calls.length - 1][1];
};

const settle = () => new Promise(process.nextTick);

beforeEach(() => {
  jest.restoreAllMocks();
  mockRefreshTimings.mockClear().mockResolvedValue([]);
  mockRescheduleIfNeeded.mockClear();
  mockEnsureAlarms.mockClear();
  mockSyncWidgetSnapshot.mockClear();
});

describe("registerForegroundReschedule", () => {
  it("registers only once", () => {
    const addListener = jest.spyOn(AppState, "addEventListener");
    jest.isolateModules(() => {
      // A static import is hoisted out of the callback, so isolateModules needs a call-time require
      // to load the module afresh.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { registerForegroundReschedule } = require("@/utils/foregroundReschedule");
      registerForegroundReschedule();
      registerForegroundReschedule();
    });

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

  // Alarms read todayTimings/tomorrowTimings (alarmScheduler.ts:38), so they are
  // scheduled from the refreshed window, not the one the last cold start left.
  it("tops up the alarms from the refreshed window", async () => {
    const handler = registerFresh();

    handler("active");
    await settle();

    expect(mockEnsureAlarms).toHaveBeenCalledTimes(1);
    expect(mockRefreshTimings.mock.invocationCallOrder[0]).toBeLessThan(
      mockEnsureAlarms.mock.invocationCallOrder[0]
    );
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
