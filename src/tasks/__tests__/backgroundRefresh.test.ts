import { BACKGROUND_EVENT, TASK_RESULT } from "@/constants/BackgroundTask";
import { TIMES_FETCH } from "@/constants/PrayerTimes";
import { BACKGROUND_REFRESH_TASK, executeBackgroundRefresh } from "@/tasks/backgroundRefresh";

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
const mockRefetch = jest.fn();
const mockClearPendingReapply = jest.fn();
const mockAwaitPendingReapply = jest.fn();
const mockGetByRange = jest.fn();
const mockBgLog = jest.fn();
const mockWaitForHydration = jest.fn();
const mockSyncWidgetSnapshot = jest.fn(async () => {});
/** Where the stored days were fetched; the place is always at MOCK_PLACE. */
let mockTimesCoords: { latitude: number; longitude: number } | null = null;
const MOCK_PLACE = { latitude: 24.7136, longitude: 46.6753 };

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
      refetchPlaceTimes: mockRefetch,
      refreshTimingsFromDb: mockRefreshTimings,
      timesCoords: mockTimesCoords,
    }),
    persist: hydratedPersist,
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: {
    getState: () => ({ locationDetails: { timezone: "Asia/Riyadh", coords: MOCK_PLACE } }),
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
// The task imports this statically; without a stub its store graph opens a database.
jest.mock("@/services/widgetSnapshot", () => ({
  syncWidgetSnapshot: () => mockSyncWidgetSnapshot(),
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
    // Reads the real clock in production; the tests drive it from `mockNow`.
    timeZonedNow: () => mockNow,
  };
});

// The mocked module instance is shared across `jest.isolateModules`, so this
// reference stays the one an isolated re-import of the SUT calls.
const { addExpirationListener: mockAddExpirationListener } = jest.requireMock(
  "expo-background-task"
) as { addExpirationListener: jest.Mock };

// 4 rows = the today..today+3 range is fully covered → no fetch needed.
const fourRows = [{ date: 1 }, { date: 2 }, { date: 3 }, { date: 4 }];

// The refetch's outcomes, as the times store reports them.
const LANDED = { stands: true, complete: true, fetched: true };
const YEAR_OWED = { stands: true, complete: false, fetched: true };
const NEXT_YEAR_FAILED = { stands: false, complete: false, fetched: true };
const NOT_LANDED = { stands: false, complete: false, fetched: false };

describe("executeBackgroundRefresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNow = new Date("2026-08-15T08:00:00Z");
    mockTimesCoords = MOCK_PLACE;
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
    expect(mockRefetch).not.toHaveBeenCalled();
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
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("writes the widget snapshot once the window has been refreshed", async () => {
    await executeBackgroundRefresh();

    expect(mockSyncWidgetSnapshot).toHaveBeenCalledTimes(1);
    // Ordering matters: the snapshot reads the window after the refresh fills it.
    expect(mockRefreshTimings.mock.invocationCallOrder[0]).toBeLessThan(
      mockSyncWidgetSnapshot.mock.invocationCallOrder[0]
    );
  });

  it("fetches when the database holds fewer than 3 future days", async () => {
    mockGetByRange.mockResolvedValue([{ date: 1 }]);
    mockRefetch.mockResolvedValue(LANDED);

    await executeBackgroundRefresh();

    expect(mockRefetch).toHaveBeenCalled();
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
    mockRefetch.mockResolvedValue(LANDED);
    // Data is sufficient — the pending reapply alone must force the fetch.
    mockGetByRange.mockResolvedValue(fourRows);

    await executeBackgroundRefresh();

    expect(mockRefetch).toHaveBeenCalled();
    expect(mockClearPendingReapply).toHaveBeenCalledTimes(1);
  });

  it("keeps the reapply flag when the forced fetch fails", async () => {
    mockAwaitPendingReapply.mockResolvedValue(true);
    mockRefetch.mockResolvedValue(NOT_LANDED);

    await executeBackgroundRefresh();

    expect(mockClearPendingReapply).not.toHaveBeenCalled();
  });

  // An adjacent year's rows hold the old settings until their own fetch lands.
  it("keeps the reapply flag while a year the place needs is owed", async () => {
    mockAwaitPendingReapply.mockResolvedValue(true);
    mockRefetch.mockResolvedValue(YEAR_OWED);

    await executeBackgroundRefresh();

    expect(mockClearPendingReapply).not.toHaveBeenCalled();
  });

  it.each([
    ["every year landed", true, LANDED],
    ["a year is owed but the stored days stand", true, YEAR_OWED],
    // This year's days landed; a late-December next-year miss is retried later.
    ["only the needed next year failed", true, NEXT_YEAR_FAILED],
    ["nothing landed", false, NOT_LANDED],
  ])("when %s, reports fetched=%s", async (_name, fetched, refetch) => {
    mockGetByRange.mockResolvedValue([{ date: 1 }]);
    mockRefetch.mockResolvedValue(refetch);

    await executeBackgroundRefresh();

    expect(mockBgLog).toHaveBeenCalledWith(
      BACKGROUND_REFRESH_TASK,
      BACKGROUND_EVENT.TASK_COMPLETED,
      expect.anything(),
      expect.stringContaining(`fetched=${fetched}`),
      expect.anything()
    );
  });

  // The move's own load fetches the new place's days.
  it("logs a refetch the place moved under as skipped, keeping the reapply flag", async () => {
    mockAwaitPendingReapply.mockResolvedValue(true);
    mockRefetch.mockResolvedValue(TIMES_FETCH.SUPERSEDED);

    await executeBackgroundRefresh();

    expect(mockBgLog).toHaveBeenCalledWith(
      BACKGROUND_REFRESH_TASK,
      BACKGROUND_EVENT.PRAYER_TIMES_SUPERSEDED,
      TASK_RESULT.SKIPPED,
      expect.any(String)
    );
    expect(mockClearPendingReapply).not.toHaveBeenCalled();
    expect(mockBgLog).toHaveBeenCalledWith(
      BACKGROUND_REFRESH_TASK,
      BACKGROUND_EVENT.TASK_COMPLETED,
      expect.anything(),
      expect.stringContaining("fetched=false"),
      expect.anything()
    );
  });

  // A failed update leaves the new place over the old place's days.
  it("fetches when the stored days were fetched for other coordinates", async () => {
    mockTimesCoords = { latitude: 21.4858, longitude: 39.1925 };
    mockRefetch.mockResolvedValue(LANDED);

    await executeBackgroundRefresh();

    expect(mockRefetch).toHaveBeenCalled();
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
