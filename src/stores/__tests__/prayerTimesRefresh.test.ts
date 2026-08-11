import { addDays, format, subDays } from "date-fns";

import { usePrayerTimesStore } from "@/stores/prayerTimes";

// Referenced lazily by the module factories below, so the `mock` prefix hoisting
// rule is satisfied and the consts are initialised before any test calls them.
const mockGetByRange = jest.fn();
const mockGetByDate = jest.fn();

jest.mock("@/services/db", () => ({
  PrayerTimesDB: {
    getPrayerTimesByDateRange: (...args: unknown[]) => mockGetByRange(...args),
    getPrayerTimesByDate: (...args: unknown[]) => mockGetByDate(...args),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: {
    getState: () => ({
      locationDetails: { timezone: "Asia/Riyadh" },
      lastKnownCoords: null,
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

const dateInt = (d: Date) => parseInt(format(d, "yyyyMMdd"));

// Rows shaped like DayPrayerTimes for a date span starting today.
const makeRows = (days: number) =>
  Array.from({ length: days }, (_, i) => ({
    date: dateInt(addDays(new Date(), i)),
    timings: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" },
    otherTimings: {},
  }));

describe("refreshTimingsFromDb", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("re-derives the projections from the database window", async () => {
    const rows = makeRows(14);
    mockGetByRange.mockResolvedValue(rows);
    mockGetByDate.mockResolvedValue({
      date: dateInt(subDays(new Date(), 1)),
      timings: {},
      otherTimings: {},
    });

    const returned = await usePrayerTimesStore.getState().refreshTimingsFromDb();

    expect(returned).toHaveLength(14);
    const state = usePrayerTimesStore.getState();
    expect(state.twoWeeksTimings).toHaveLength(14);
    expect(state.todayTimings?.date).toBe(dateInt(new Date()));
    expect(state.tomorrowTimings?.date).toBe(dateInt(addDays(new Date(), 1)));
    // Window: today .. today+13 as YYYYMMDD ints
    expect(mockGetByRange).toHaveBeenCalledWith(
      dateInt(new Date()),
      dateInt(addDays(new Date(), 13))
    );
  });

  it("sets twoWeeksTimings to null when the database is empty", async () => {
    mockGetByRange.mockResolvedValue([]);
    mockGetByDate.mockResolvedValue(null);

    const returned = await usePrayerTimesStore.getState().refreshTimingsFromDb();

    expect(returned).toEqual([]);
    expect(usePrayerTimesStore.getState().twoWeeksTimings).toBeNull();
  });
});
