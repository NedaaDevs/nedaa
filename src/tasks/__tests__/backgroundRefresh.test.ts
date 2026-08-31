import { executeBackgroundRefresh } from "@/tasks/backgroundRefresh";

// The factories below read `hydratedPersist` eagerly, at the moment the SUT
// imports a mocked store. babel-plugin-jest-hoist lifts the `jest.mock` calls
// above the imports and carries a referenced const with them only when its
// initialiser is pure, so this has to stay a plain object literal: a
// `jest.fn()` member or any computed value stops the hoist and the factory then
// hits the temporal dead zone with a ReferenceError.
const hydratedPersist = {
  hasHydrated: () => true,
  onFinishHydration: (_fn: () => void) => () => {},
};

// Referenced lazily by the module factories below, so the `mock` prefix hoisting
// rule is satisfied and the consts are initialised before any test calls them.
const mockScheduleAll = jest.fn();
const mockRefreshTimings = jest.fn();
const mockGetAndStore = jest.fn();
const mockClearPendingReapply = jest.fn();
const mockAwaitPendingReapply = jest.fn();
const mockGetByRange = jest.fn();
const mockBgLog = jest.fn();
const mockWaitForHydration = jest.fn();

let mockNow = new Date("2026-08-15T08:00:00Z");

jest.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  getStatusAsync: jest.fn(async () => 2),
  registerTaskAsync: jest.fn(async () => {}),
  unregisterTaskAsync: jest.fn(async () => {}),
  // Owned by the factory rather than an outer const: the SUT registers its
  // listener at import time, before any module-scope initialiser here runs.
  addExpirationListener: jest.fn(() => ({ remove: () => {} })),
}));
jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
}));
jest.mock("@/services/db", () => ({
  PrayerTimesDB: { getPrayerTimesByDateRange: (...args: unknown[]) => mockGetByRange(...args) },
}));
jest.mock("@/services/background-task-log", () => ({
  BackgroundTaskLog: { log: (...args: unknown[]) => mockBgLog(...args) },
}));
jest.mock("@/stores/notification", () => ({
  useNotificationStore: {
    getState: () => ({ scheduleAllNotifications: mockScheduleAll }),
    persist: hydratedPersist,
  },
}));
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: {
    getState: () => ({
      getAndStorePrayerTimes: mockGetAndStore,
      refreshTimingsFromDb: mockRefreshTimings,
    }),
    persist: hydratedPersist,
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: {
    getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }),
    persist: hydratedPersist,
  },
}));
jest.mock("@/stores/providerSettings", () => ({
  useProviderSettingsStore: {
    getState: () => ({ clearPendingReapply: mockClearPendingReapply }),
    persist: hydratedPersist,
  },
  awaitPendingReapply: (...args: unknown[]) => mockAwaitPendingReapply(...args),
}));
jest.mock("@/stores/customSounds", () => ({
  useCustomSoundsStore: { persist: hydratedPersist },
}));
jest.mock("@/stores/quranReminders", () => ({
  useQuranRemindersStore: { persist: hydratedPersist },
}));
jest.mock("@/utils/storeHydration", () => ({
  waitForHydration: (...args: unknown[]) => mockWaitForHydration(...args),
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    flushAll: jest.fn(),
    create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn(), d: jest.fn() }),
    registerReportSection: jest.fn(),
  },
}));
jest.mock("@/utils/date", () => {
  const actual = jest.requireActual("@/utils/date");
  return {
    ...actual,
    // All three read the real clock in production; the tests drive them from
    // one `mockNow` so the December case is reachable.
    timeZonedNow: () => mockNow,
    getTimezoneMonth: () => mockNow.getUTCMonth() + 1,
    getTimezoneYear: () => mockNow.getUTCFullYear(),
  };
});

// The mocked module instance is shared across `jest.isolateModules`, so this
// reference stays the one an isolated re-import of the SUT calls.
const { addExpirationListener: mockAddExpirationListener } = jest.requireMock(
  "expo-background-task"
) as { addExpirationListener: jest.Mock };

// 4 rows = the today..today+3 range is fully covered → no fetch needed.
const fourRows = [{ date: 1 }, { date: 2 }, { date: 3 }, { date: 4 }];

describe("executeBackgroundRefresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNow = new Date("2026-08-15T08:00:00Z");
    // Every gated store is hydrated unless a test says otherwise.
    mockWaitForHydration.mockImplementation(async () => {});
    mockAwaitPendingReapply.mockResolvedValue(false);
    mockGetByRange.mockResolvedValue(fourRows);
    mockRefreshTimings.mockResolvedValue(fourRows);
    mockScheduleAll.mockResolvedValue({ success: true, scheduledCount: 10 });
  });

  it("skips the whole run when a gated store fails to hydrate", async () => {
    mockWaitForHydration.mockImplementation(async (_persist, opts) => {
      opts?.onTimeout?.();
    });

    const result = await executeBackgroundRefresh();

    expect(result).toBe(2); // Failed
    expect(mockGetAndStore).not.toHaveBeenCalled();
    expect(mockScheduleAll).not.toHaveBeenCalled();
  });

  it("refreshes the window from the database before it reschedules", async () => {
    const result = await executeBackgroundRefresh();

    expect(result).toBe(1); // Success
    expect(mockRefreshTimings).toHaveBeenCalledTimes(1);
    // The window refresh must precede the reschedule.
    expect(mockRefreshTimings.mock.invocationCallOrder[0]).toBeLessThan(
      mockScheduleAll.mock.invocationCallOrder[0]
    );
    expect(mockGetAndStore).not.toHaveBeenCalled();
  });

  it("fetches when the database holds fewer than 3 future days", async () => {
    mockGetByRange.mockResolvedValue([{ date: 1 }]);
    mockGetAndStore.mockResolvedValue(true);

    await executeBackgroundRefresh();

    expect(mockGetAndStore).toHaveBeenCalled();
    expect(mockScheduleAll).toHaveBeenCalledTimes(1);
  });

  it("reports a failed schedule run as Failed", async () => {
    mockScheduleAll.mockResolvedValue({
      success: false,
      scheduledCount: 0,
      error: new Error("boom"),
    });

    const result = await executeBackgroundRefresh();

    expect(result).toBe(2); // Failed
  });

  it("forces a refetch when a provider reapply is pending, then clears the flag", async () => {
    mockAwaitPendingReapply.mockResolvedValue(true);
    mockGetAndStore.mockResolvedValue(true);
    // Data is sufficient — the pending reapply alone must force the fetch.
    mockGetByRange.mockResolvedValue(fourRows);

    await executeBackgroundRefresh();

    expect(mockGetAndStore).toHaveBeenCalled();
    expect(mockClearPendingReapply).toHaveBeenCalledTimes(1);
  });

  it("keeps the reapply flag when the forced fetch fails", async () => {
    mockAwaitPendingReapply.mockResolvedValue(true);
    mockGetAndStore.mockResolvedValue(false);

    await executeBackgroundRefresh();

    expect(mockClearPendingReapply).not.toHaveBeenCalled();
  });

  it("also fetches the next year in December", async () => {
    mockNow = new Date("2026-12-30T08:00:00Z");
    mockGetByRange.mockResolvedValue([{ date: 1 }]);
    mockGetAndStore.mockResolvedValue(true);

    await executeBackgroundRefresh();

    // First call: whole current year (no args). Second call: next year.
    expect(mockGetAndStore).toHaveBeenNthCalledWith(1);
    expect(mockGetAndStore).toHaveBeenNthCalledWith(2, 2027);
  });

  it("does not fetch the next year outside December", async () => {
    mockGetByRange.mockResolvedValue([{ date: 1 }]);
    mockGetAndStore.mockResolvedValue(true);

    await executeBackgroundRefresh();

    expect(mockGetAndStore).toHaveBeenCalledTimes(1);
  });
});

describe("expiration listener", () => {
  it("registers an iOS expiration listener at module scope", () => {
    // Registration happens at import time and the other suite's beforeEach
    // clears all mocks, so re-evaluate the module in isolation instead of
    // counting calls from the original import.
    jest.isolateModules(() => {
      mockAddExpirationListener.mockClear();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/tasks/backgroundRefresh");
      expect(mockAddExpirationListener).toHaveBeenCalledTimes(1);
    });
  });
});

// A queued WorkManager backlog invokes the task many times at once. Each run
// rebuilds the whole notification set, so overlapping runs race the same alarm
// budget; the guard collapses them into one.
describe("single-flight guard", () => {
  const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    jest.clearAllMocks();
    mockNow = new Date("2026-08-15T08:00:00Z");
    mockWaitForHydration.mockImplementation(async () => {});
    mockAwaitPendingReapply.mockResolvedValue(false);
    mockGetByRange.mockResolvedValue(fourRows);
    mockRefreshTimings.mockResolvedValue(fourRows);
    mockScheduleAll.mockResolvedValue({ success: true, scheduledCount: 10 });
  });

  it("runs the work once when invoked concurrently, and gives both callers that result", async () => {
    let releaseSchedule: (() => void) | null = null;
    mockScheduleAll.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSchedule = () => resolve({ success: true, scheduledCount: 10 });
        })
    );

    const first = executeBackgroundRefresh();
    const second = executeBackgroundRefresh();
    await flushMicrotasks();

    expect(mockScheduleAll).toHaveBeenCalledTimes(1);

    releaseSchedule!();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toBe(1); // Success
    expect(secondResult).toBe(firstResult);
  });

  it("starts a fresh run once the previous one has settled", async () => {
    await executeBackgroundRefresh();
    await executeBackgroundRefresh();

    expect(mockScheduleAll).toHaveBeenCalledTimes(2);
  });

  it("releases the guard when a run fails, so the next invocation is not wedged", async () => {
    mockScheduleAll.mockRejectedValueOnce(new Error("scheduling blew up"));

    expect(await executeBackgroundRefresh()).toBe(2); // Failed

    mockScheduleAll.mockResolvedValue({ success: true, scheduledCount: 10 });

    expect(await executeBackgroundRefresh()).toBe(1); // Success
  });
});
