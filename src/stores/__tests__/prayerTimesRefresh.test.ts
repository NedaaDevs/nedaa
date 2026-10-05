import { addDays, format, subDays } from "date-fns";

import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { syncWidgetSnapshot } from "@/services/widgetSnapshot";

// Referenced lazily by the module factories below, so the `mock` prefix hoisting
// rule is satisfied and the consts are initialised before any test calls them.
const mockGetByRange = jest.fn();
const mockGetByDate = jest.fn();
const mockInsertPrayerTimes = jest.fn();
const mockSetTimezone = jest.fn();

let mockNow = new Date("2026-08-15T08:00:00Z");

jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: jest.fn(async () => {}) }));
jest.mock("@/services/db", () => ({
  PrayerTimesDB: {
    getPrayerTimesByDateRange: (...args: unknown[]) => mockGetByRange(...args),
    getPrayerTimesByDate: (...args: unknown[]) => mockGetByDate(...args),
    insertPrayerTimes: (...args: unknown[]) => mockInsertPrayerTimes(...args),
    cleanData: async () => true,
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: {
    getState: () => ({
      locationDetails: { timezone: "Asia/Riyadh" },
      lastKnownCoords: null,
      setTimezone: mockSetTimezone,
    }),
  },
}));
jest.mock("@/stores/providerSettings", () => ({
  __esModule: true,
  default: { getState: () => ({ currentProviderId: "aladhan" }) },
  useProviderSettingsStore: { getState: () => ({ currentProviderId: "aladhan" }) },
}));
jest.mock("@/stores/app", () => ({
  useAppStore: { getState: () => ({ setLoadingState: jest.fn() }) },
}));
jest.mock("@/localization/i18n", () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock("@/api/prayerTimes.api", () => ({ prayerTimesApi: {} }));
jest.mock("@/adapters/providers", () => ({ getAdapterByProviderId: jest.fn() }));
jest.mock("@/utils/location", () => ({ checkLocationPermission: jest.fn() }));
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));
jest.mock("../../../modules/expo-widget/src", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("../../../modules/expo-widgets/src", () => ({ refreshAllWidgets: jest.fn() }));
jest.mock("@/utils/date", () => {
  const actual = jest.requireActual("@/utils/date");
  // The store reads the clock through `timeZonedNow`; a fixed instant keeps the
  // expected date ints stable whatever the machine's own date is.
  return { ...actual, timeZonedNow: () => mockNow };
});

const dateInt = (d: Date) => parseInt(format(d, "yyyyMMdd"));

// Rows shaped like DayPrayerTimes for a date span starting on the mocked today.
// `format` renders in the machine's timezone, so rows and expectations both go
// through it from the same instant and agree on every machine.
const makeRows = (days: number) =>
  Array.from({ length: days }, (_, i) => ({
    date: dateInt(addDays(mockNow, i)),
    timings: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" },
    otherTimings: {},
  }));

describe("refreshTimingsFromDb", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNow = new Date("2026-08-15T08:00:00Z");
  });

  it("re-derives the projections from the database window", async () => {
    const rows = makeRows(14);
    mockGetByRange.mockResolvedValue(rows);
    mockGetByDate.mockResolvedValue({
      date: dateInt(subDays(mockNow, 1)),
      timings: {},
      otherTimings: {},
    });

    const returned = await usePrayerTimesStore.getState().refreshTimingsFromDb();

    expect(returned).toHaveLength(14);
    const state = usePrayerTimesStore.getState();
    expect(state.twoWeeksTimings).toHaveLength(14);
    expect(state.todayTimings?.date).toBe(dateInt(mockNow));
    expect(state.tomorrowTimings?.date).toBe(dateInt(addDays(mockNow, 1)));
    // Window: today .. today+13 as YYYYMMDD ints
    expect(mockGetByRange).toHaveBeenCalledWith(dateInt(mockNow), dateInt(addDays(mockNow, 13)));
  });

  it("sets twoWeeksTimings to null when the database is empty", async () => {
    mockGetByRange.mockResolvedValue([]);
    mockGetByDate.mockResolvedValue(null);

    const returned = await usePrayerTimesStore.getState().refreshTimingsFromDb();

    expect(returned).toEqual([]);
    expect(usePrayerTimesStore.getState().twoWeeksTimings).toBeNull();
  });
});

describe("prayer widget recovery", () => {
  const { getPrayerTimes, getAndStorePrayerTimes } = usePrayerTimesStore.getState();
  beforeEach(() => {
    jest.clearAllMocks();
    mockNow = new Date("2026-08-15T08:00:00Z");
    usePrayerTimesStore.setState({ didGetCurrentLocation: true });
  });
  afterEach(() => {
    // Zustand replaces its state object, so restoring a spy's original object
    // alone does not restore the function in the current state.
    usePrayerTimesStore.setState({ getPrayerTimes, getAndStorePrayerTimes });
  });

  it("republishes cached days when opening the app without a fetch", async () => {
    mockGetByRange.mockResolvedValue(makeRows(14));
    mockGetByDate.mockResolvedValue({ date: dateInt(subDays(mockNow, 1)) });
    const fetch = jest.spyOn(usePrayerTimesStore.getState(), "getAndStorePrayerTimes");
    await usePrayerTimesStore.getState().loadPrayerTimes();
    expect(fetch).not.toHaveBeenCalled();
    expect(syncWidgetSnapshot).toHaveBeenCalledTimes(1);
    fetch.mockRestore();
  });

  it("publishes a snapshot after storing fresh prayer times", async () => {
    const data = { timezone: "Asia/Riyadh", days: [] };
    const fetch = jest
      .spyOn(usePrayerTimesStore.getState(), "getPrayerTimes")
      .mockResolvedValue(data as never);
    mockInsertPrayerTimes.mockResolvedValue({ success: true });
    await expect(usePrayerTimesStore.getState().getAndStorePrayerTimes()).resolves.toBe(true);
    expect(syncWidgetSnapshot).toHaveBeenCalledTimes(1);
    expect(mockInsertPrayerTimes.mock.invocationCallOrder[0]).toBeLessThan(
      (syncWidgetSnapshot as jest.Mock).mock.invocationCallOrder[0]
    );
    fetch.mockRestore();
  });

  it("republishes available days even when the launch fetch fails offline", async () => {
    mockGetByRange.mockResolvedValue(makeRows(1));
    mockGetByDate.mockResolvedValue(null);
    const fetch = jest
      .spyOn(usePrayerTimesStore.getState(), "getAndStorePrayerTimes")
      .mockResolvedValue(false);
    await expect(usePrayerTimesStore.getState().loadPrayerTimes()).rejects.toThrow();
    expect(syncWidgetSnapshot).toHaveBeenCalledTimes(1);
    fetch.mockRestore();
  });
});
