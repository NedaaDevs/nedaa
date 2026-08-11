import { executeBackgroundRefresh } from "@/tasks/backgroundRefresh";

// Referenced lazily by the module factories below, so the `mock` prefix hoisting
// rule is satisfied and the consts are initialised before any test calls them.
const hydratedPersist = {
  hasHydrated: () => true,
  onFinishHydration: (_fn: () => void) => () => {},
};

const mockScheduleAll = jest.fn();
const mockRefreshTimings = jest.fn();
const mockGetAndStore = jest.fn();
const mockClearPendingReapply = jest.fn();
const mockAwaitPendingReapply = jest.fn();
const mockGetByRange = jest.fn();
const mockBgLog = jest.fn();
const mockAddExpirationListener = jest.fn((..._args: unknown[]) => ({ remove: () => {} }));

let mockNow = new Date("2026-08-15T08:00:00Z");

jest.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  getStatusAsync: jest.fn(async () => 2),
  registerTaskAsync: jest.fn(async () => {}),
  unregisterTaskAsync: jest.fn(async () => {}),
  addExpirationListener: (...args: unknown[]) => mockAddExpirationListener(...args),
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

// 4 rows = the today..today+3 range is fully covered → no fetch needed.
const fourRows = [{ date: 1 }, { date: 2 }, { date: 3 }, { date: 4 }];

describe("executeBackgroundRefresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNow = new Date("2026-08-15T08:00:00Z");
    mockAwaitPendingReapply.mockResolvedValue(false);
    mockGetByRange.mockResolvedValue(fourRows);
    mockRefreshTimings.mockResolvedValue(fourRows);
    mockScheduleAll.mockResolvedValue({ success: true, scheduledCount: 10 });
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
