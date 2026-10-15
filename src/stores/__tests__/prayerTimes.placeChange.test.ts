import { addDays, eachDayOfInterval, endOfMonth } from "date-fns";

import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { RIYADH_DAY, RIYADH_ZONE } from "@/test-helpers/prayerDay";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { dateToInt } from "@/utils/date";

// A row's zone names the place it was fetched for.
const OLD_ZONE = "Europe/London";
const NEW_ZONE = RIYADH_ZONE;

// The prayer_times table: one row per date, a later write replaces the row.
const mockTable = new Map<number, DayPrayerTimes>();
let mockNow = new Date();

jest.mock("@/services/db", () => ({
  PrayerTimesDB: {
    insertPrayerTimes: async ({ days }: { days: DayPrayerTimes[] }) => {
      days.forEach((day) => mockTable.set(day.date, day));
      return { success: true, insertedCount: days.length };
    },
    getPrayerTimesByDate: async (date: number) => mockTable.get(date) ?? null,
    getPrayerTimesByDateRange: async (start: number, end: number) =>
      [...mockTable.values()]
        .filter(({ date }) => date >= start && date <= end)
        .sort((a, b) => a.date - b.date),
    cleanData: async (cutoff: number) => {
      [...mockTable.keys()].filter((date) => date < cutoff).forEach((d) => mockTable.delete(d));
      return true;
    },
  },
}));
jest.mock("@/stores/location", () => {
  const place = jest.requireActual("@/test-helpers/prayerDay");
  const state = {
    locationDetails: { timezone: place.RIYADH_ZONE },
    lastKnownCoords: place.RIYADH_COORDS,
    setTimezone: async () => {},
  };
  return { __esModule: true, default: { getState: () => state } };
});
jest.mock("@/stores/providerSettings", () => ({
  __esModule: true,
  default: { getState: () => ({ setInEffect: () => {} }) },
}));
jest.mock("@/adapters/providers", () => ({
  getAdapterByProviderId: () => ({ fromApplied: () => null }),
}));
jest.mock("@/api/prayerTimes.api", () => ({ prayerTimesApi: {} }));
jest.mock("@/utils/location", () => ({ checkLocationPermission: jest.fn() }));
jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: async () => {} }));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
// The place's clock is a wall time; the test sets it directly.
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  timeZonedNow: () => mockNow,
  getTimezoneYear: () => mockNow.getFullYear(),
  getTimezoneMonth: () => mockNow.getMonth() + 1,
}));

const row = (day: Date, timezone: string): DayPrayerTimes => ({
  ...RIYADH_DAY,
  date: dateToInt(day),
  timezone,
});

/** The new place's times as the API serves them: the year, from `month` on. */
const serveNewPlace = async (yearOverride?: number, month = 1) => {
  const year = yearOverride ?? mockNow.getFullYear();
  const days = Array.from({ length: 13 - month }, (_, index) => {
    const first = new Date(year, month - 1 + index, 1);
    return eachDayOfInterval({ start: first, end: endOfMonth(first) });
  }).flat();
  return { timezone: NEW_ZONE, days: days.map((day) => row(day, NEW_ZONE)) };
};

/** Every day a load reads, as the store holds them. */
const daysRead = () => {
  const { yesterdayTimings, todayTimings, tomorrowTimings, twoWeeksTimings } =
    usePrayerTimesStore.getState();
  return [yesterdayTimings, todayTimings, tomorrowTimings, ...(twoWeeksTimings ?? [])];
};

const { getPrayerTimes } = usePrayerTimesStore.getState();

/** The old place's days, from two days before `today` to two weeks on. */
const storeOldPlace = (today: Date) => {
  mockTable.clear();
  for (let offset = -2; offset <= 13; offset += 1) {
    const day = row(addDays(today, offset), OLD_ZONE);
    mockTable.set(day.date, day);
  }
};

afterEach(() => usePrayerTimesStore.setState({ getPrayerTimes }));

/** The dates of stored days that still hold the old place's times. */
const oldPlaceDates = () =>
  [...mockTable.values()].filter(({ timezone }) => timezone !== NEW_ZONE).map(({ date }) => date);

// Rows carry no place, so a refetch must cover every day the table keeps;
// the iOS widget takes its zone from the oldest one.
describe("a forced refetch after a place change", () => {
  it.each([
    ["the 1st of a month", new Date(2026, 8, 1, 12)],
    ["the 1st of January", new Date(2027, 0, 1, 12)],
    ["the 2nd of a month", new Date(2026, 8, 2, 12)],
    ["mid-month", new Date(2026, 6, 15, 12)],
    ["late December", new Date(2026, 11, 25, 12)],
    ["the 31st of December", new Date(2026, 11, 31, 12)],
  ])("on %s, leaves no stored day at the old place", async (_name, today) => {
    mockNow = today;
    storeOldPlace(today);
    usePrayerTimesStore.setState({ getPrayerTimes: jest.fn(serveNewPlace) as never });

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true);

    const read = daysRead();
    expect(read).not.toContain(null);
    expect(read.map((day) => day?.timezone)).toEqual(read.map(() => NEW_ZONE));
    expect(oldPlaceDates()).toEqual([]);
  });

  // The stored days stand until a refetch succeeds.
  it("keeps the stored days when the refetch fails", async () => {
    mockNow = new Date(2026, 8, 1, 12);
    storeOldPlace(mockNow);
    const stored = new Map(mockTable);
    usePrayerTimesStore.setState({
      getPrayerTimes: jest.fn(async () => {
        throw new Error("offline");
      }),
    });

    await expect(
      usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true)
    ).rejects.toThrow();

    expect(daysRead()).not.toContain(null);
    expect(mockTable).toEqual(stored);
  });
});
