import { addDays, eachDayOfInterval, endOfMonth } from "date-fns";
import { reloadPrayerWidgets } from "expo-widget";

import { LocationMode } from "@/enums/location";
import locationStore from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { executeBackgroundRefresh } from "@/tasks/backgroundRefresh";
import { RIYADH_COORDS, RIYADH_DAY, RIYADH_ZONE } from "@/test-helpers/prayerDay";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { dateToInt } from "@/utils/date";
import { checkLocationPermission } from "@/utils/location";
import type { Coords } from "@/types/location";

// A row's zone names the place it was fetched for.
const OLD_ZONE = "Europe/London";
const OLD_COORDS = { latitude: 51.5072, longitude: -0.1276 };
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
    locationDetails: { timezone: place.RIYADH_ZONE, coords: place.RIYADH_COORDS },
    lastKnownCoords: place.RIYADH_COORDS,
    setTimezone: jest.fn((timezone: string) => {
      state.locationDetails = { ...state.locationDetails, timezone };
    }),
  };
  return { __esModule: true, default: { getState: () => state } };
});
jest.mock("@/stores/providerSettings", () => {
  const store = { getState: () => ({ setInEffect: () => {}, clearPendingReapply: () => {} }) };
  return {
    __esModule: true,
    default: store,
    useProviderSettingsStore: store,
    awaitPendingReapply: async () => false,
  };
});
// The background task's other stores and services; it runs over the real
// times store and this table.
jest.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  addExpirationListener: () => ({ remove: () => {} }),
}));
jest.mock("expo-task-manager", () => ({ defineTask: () => {} }));
jest.mock("@/services/background-task-log", () => ({
  BackgroundTaskLog: { log: async () => {} },
}));
jest.mock("@/stores/notification", () => ({
  useNotificationStore: {
    getState: () => ({
      scheduleAllNotifications: async () => ({ success: true, scheduledCount: 0 }),
    }),
  },
}));
jest.mock("@/stores/customSounds", () => ({ useCustomSoundsStore: {} }));
jest.mock("@/stores/quranReminders", () => ({ useQuranRemindersStore: {} }));
jest.mock("@/utils/storeHydration", () => ({ waitForHydration: async () => {} }));
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

const SECOND_COORDS = { latitude: 25.2048, longitude: 55.2708 };
const SECOND_ZONE = "Asia/Dubai";

/** The API's days in the zone the store holds as the request is sent. */
const servePlaceHeld = async (yearOverride?: number, month?: number) => {
  const { timezone } = locationStore.getState().locationDetails;
  const served = await serveNewPlace(yearOverride, month);
  return { timezone, days: served.days.map((day) => ({ ...day, timezone })) };
};

/** Every day a load reads, as the store holds them. */
const daysRead = () => {
  const { yesterdayTimings, todayTimings, tomorrowTimings, twoWeeksTimings } =
    usePrayerTimesStore.getState();
  return [yesterdayTimings, todayTimings, tomorrowTimings, ...(twoWeeksTimings ?? [])];
};

/** The new place's API, with every fetch of `failingYear` offline. */
const serveNewPlaceExcept = (failingYear: number) =>
  jest.fn(async (yearOverride?: number, month?: number) => {
    if (yearOverride === failingYear) throw new Error("offline");
    return serveNewPlace(yearOverride, month);
  });

const { getPrayerTimes, usingDefaultLocation } = usePrayerTimesStore.getState();

/** The old place's days, from two days before `today` to two weeks on. */
const storeOldPlace = (today: Date) => {
  mockTable.clear();
  for (let offset = -2; offset <= 13; offset += 1) {
    const day = row(addDays(today, offset), OLD_ZONE);
    mockTable.set(day.date, day);
  }
};

/** Where the location store says the place is, as the times store reads it. */
const placeAt = (coords: Coords, timezone = NEW_ZONE) =>
  Object.assign(locationStore.getState().locationDetails, { coords, timezone });

afterEach(() => {
  usePrayerTimesStore.setState({ getPrayerTimes, usingDefaultLocation, timesCoords: null });
  placeAt(RIYADH_COORDS);
});

/** The dates of stored days that hold another place's times than `zone`'s. */
const datesNotAt = (zone: string) =>
  [...mockTable.values()].filter(({ timezone }) => timezone !== zone).map(({ date }) => date);

/** The dates of stored days that still hold the old place's times. */
const oldPlaceDates = () => datesNotAt(NEW_ZONE);

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

// The table keeps two days back and a load reads 13 days on; near New Year
// some of those days are in the adjacent year.
describe("a refetch at a year boundary", () => {
  it.each([
    ["the 1st of January", new Date(2027, 0, 1, 12), 2026],
    ["the 2nd of January", new Date(2027, 0, 2, 12), 2026],
    ["the 19th of December", new Date(2026, 11, 19, 12), 2027],
    ["late December", new Date(2026, 11, 25, 12), 2027],
  ])("on %s, fails when the adjacent year fails", async (_name, today, failingYear) => {
    mockNow = today;
    storeOldPlace(today);
    usePrayerTimesStore.setState({ getPrayerTimes: serveNewPlaceExcept(failingYear) as never });

    await expect(
      usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true)
    ).rejects.toThrow();
  });

  it.each([
    ["the 3rd of January", new Date(2027, 0, 3, 12), 2026, false],
    ["mid-January", new Date(2027, 0, 15, 12), 2026, false],
    ["early December", new Date(2026, 11, 5, 12), 2027, true],
    ["the 18th of December", new Date(2026, 11, 18, 12), 2027, true],
  ])("on %s, succeeds without the adjacent year", async (_name, today, failingYear, asked) => {
    mockNow = today;
    storeOldPlace(today);
    const api = serveNewPlaceExcept(failingYear);
    usePrayerTimesStore.setState({ getPrayerTimes: api as never });

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true);

    // Last year holds no kept day from the 3rd, so it is not even asked for.
    expect(api.mock.calls.map(([year]) => year).includes(failingYear)).toBe(asked);
    const read = daysRead();
    expect(read).not.toContain(null);
    expect(read.map((day) => day?.timezone)).toEqual(read.map(() => NEW_ZONE));
    expect(oldPlaceDates()).toEqual([]);
  });

  it.each([
    ["early December", new Date(2026, 11, 5, 12)],
    ["the 18th of December", new Date(2026, 11, 18, 12)],
  ])("on %s, resolves false while next year's days are owed", async (_name, today) => {
    mockNow = today;
    storeOldPlace(today);
    usePrayerTimesStore.setState({ getPrayerTimes: serveNewPlaceExcept(2027) as never });

    await expect(usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true)).resolves.toBe(
      false
    );
  });

  it("resolves true once every year it fetched landed", async () => {
    mockNow = new Date(2026, 11, 5, 12);
    storeOldPlace(mockNow);
    usePrayerTimesStore.setState({ getPrayerTimes: jest.fn(serveNewPlace) as never });

    await expect(usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true)).resolves.toBe(
      true
    );
  });

  // A newly verified place is best effort; the flag waits for a full refetch.
  it("keeps the default-place flag when a needed adjacent year fails", async () => {
    mockNow = new Date(2027, 0, 1, 12);
    storeOldPlace(mockNow);
    usePrayerTimesStore.setState({
      usingDefaultLocation: true,
      getPrayerTimes: serveNewPlaceExcept(2026) as never,
    });

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();

    expect(usePrayerTimesStore.getState().usingDefaultLocation).toBe(true);
  });
});

// The location step writes the new place before the times step fetches its
// days; a kill or a failed fetch in between leaves the old place's days.
describe("a load after the place moved", () => {
  const JEDDAH_COORDS = { latitude: 21.4858, longitude: 39.1925 };
  const today = new Date(2026, 8, 15, 12);

  beforeEach(() => {
    mockNow = today;
    storeOldPlace(today);
    placeAt(RIYADH_COORDS, OLD_ZONE);
    usePrayerTimesStore.setState({ usingDefaultLocation: false, timesCoords: OLD_COORDS });
  });

  it("refetches the days when they were fetched for other coordinates", async () => {
    usePrayerTimesStore.setState({ getPrayerTimes: jest.fn(serveNewPlace) as never });

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();

    expect(oldPlaceDates()).toEqual([]);
    expect(usePrayerTimesStore.getState().timesCoords).toEqual(RIYADH_COORDS);
  });

  // Rows carry the zone they were fetched in; the place takes it on.
  it("takes the fetched days' zone as the place's", async () => {
    usePrayerTimesStore.setState({ getPrayerTimes: jest.fn(serveNewPlace) as never });

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();

    expect(locationStore.getState().locationDetails.timezone).toBe(NEW_ZONE);
  });

  it("fails the load, keeping the shown days, when that refetch fails", async () => {
    usePrayerTimesStore.setState({
      getPrayerTimes: jest.fn(async () => {
        throw new Error("offline");
      }),
    });

    await expect(usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace()).rejects.toThrow();

    expect(daysRead()).not.toContain(null);
    expect(usePrayerTimesStore.getState().hasError).toBe(true);
  });

  // The update's own fetch failed after the read: the next load still knows.
  it("refetches on the next load after a forced fetch failed", async () => {
    usePrayerTimesStore.setState({
      getPrayerTimes: jest.fn(async () => {
        throw new Error("offline");
      }),
    });
    await expect(
      usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true)
    ).rejects.toThrow();
    const api = jest.fn(serveNewPlace);
    usePrayerTimesStore.setState({ getPrayerTimes: api as never });

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();

    expect(api).toHaveBeenCalled();
    expect(oldPlaceDates()).toEqual([]);
  });

  // The move starts its own load, which fetches the moved place's days.
  it("writes nothing, and ends quietly, when the place moves during the fetch", async () => {
    const stored = new Map(mockTable);
    const api = jest.fn(async (yearOverride?: number, month?: number) => {
      placeAt(JEDDAH_COORDS, OLD_ZONE);
      return serveNewPlace(yearOverride, month);
    });
    usePrayerTimesStore.setState({ getPrayerTimes: api as never });

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();

    expect(mockTable).toEqual(stored);
    expect(usePrayerTimesStore.getState().timesCoords).toEqual(OLD_COORDS);
    expect(usePrayerTimesStore.getState().hasError).toBe(false);
    expect(locationStore.getState().locationDetails.timezone).toBe(OLD_ZONE);
  });

  it("on 25 December, ends quietly when the place moves during next year's fetch", async () => {
    mockNow = new Date(2026, 11, 25, 12);
    storeOldPlace(mockNow);
    const api = jest.fn(async (yearOverride?: number, month?: number) => {
      if (yearOverride !== undefined) placeAt(JEDDAH_COORDS, OLD_ZONE);
      return serveNewPlace(yearOverride, month);
    });
    usePrayerTimesStore.setState({ getPrayerTimes: api as never });

    await expect(usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace()).resolves.toBe(
      true
    );

    expect(usePrayerTimesStore.getState().timesCoords).toEqual(OLD_COORDS);
    expect(usePrayerTimesStore.getState().hasError).toBe(false);
  });

  // The insert and widget writes run between this year's fetch and next
  // year's; the mark must hold for both years' rows.
  it("on 5 December, leaves the place unmarked when it moves between the years", async () => {
    mockNow = new Date(2026, 11, 5, 12);
    storeOldPlace(mockNow);
    placeAt(RIYADH_COORDS, NEW_ZONE);
    jest
      .mocked(reloadPrayerWidgets)
      .mockImplementationOnce(() => placeAt(SECOND_COORDS, SECOND_ZONE));
    usePrayerTimesStore.setState({ getPrayerTimes: jest.fn(servePlaceHeld) as never });
    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();
    expect(usePrayerTimesStore.getState().timesCoords).toEqual(OLD_COORDS);

    // Back at the first place, a launch load refetches next year's days.
    placeAt(RIYADH_COORDS, NEW_ZONE);
    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();

    expect(datesNotAt(NEW_ZONE)).toEqual([]);
  });

  // Next year's days are read from 19 December; a move whose next-year fetch
  // failed leaves the old place's there, under no mark of the new place.
  it.each([
    ["late December, where the load needs them", new Date(2026, 11, 25, 12)],
    ["early December, before it does", new Date(2026, 11, 5, 12)],
  ])("on %s, refetches next year's days on a later load", async (_name, moveDay) => {
    mockNow = moveDay;
    storeOldPlace(moveDay);
    // Next year's first fortnight, as an earlier December fetch stored it.
    for (let day = 1; day <= 14; day += 1) {
      const kept = row(new Date(2027, 0, day, 12), OLD_ZONE);
      mockTable.set(kept.date, kept);
    }
    usePrayerTimesStore.setState({ getPrayerTimes: serveNewPlaceExcept(2027) as never });
    await usePrayerTimesStore
      .getState()
      .loadPrayerTimesAtCurrentPlace(true)
      .catch(() => {});
    mockNow = new Date(2026, 11, 31, 12);
    const api = jest.fn(serveNewPlace);
    usePrayerTimesStore.setState({ getPrayerTimes: api as never });

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();

    expect(api.mock.calls.map(([year]) => year)).toContain(2027);
    expect(oldPlaceDates()).toEqual([]);
  });

  // A fix at the same place drifts a few metres; that is not a move.
  it("keeps the stored days through a fix's drift", async () => {
    const api = jest.fn(async () => {
      throw new Error("offline");
    });
    usePrayerTimesStore.setState({ timesCoords: RIYADH_COORDS, getPrayerTimes: api });
    placeAt(
      { latitude: RIYADH_COORDS.latitude + 0.0004, longitude: RIYADH_COORDS.longitude - 0.0003 },
      OLD_ZONE
    );

    await expect(usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace()).resolves.toBe(
      true
    );

    expect(api).not.toHaveBeenCalled();
  });

  // An install from before the mark has none; its days are the saved place's.
  it("keeps unmarked stored days, marking them with the saved place", async () => {
    const api = jest.fn(async () => {
      throw new Error("offline");
    });
    usePrayerTimesStore.setState({ timesCoords: null, getPrayerTimes: api });

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();

    expect(api).not.toHaveBeenCalled();
    expect(daysRead()).not.toContain(null);
    expect(usePrayerTimesStore.getState().timesCoords).toEqual(RIYADH_COORDS);
  });

  it("refetches unmarked days on the load after a move whose fetch failed", async () => {
    usePrayerTimesStore.setState({
      timesCoords: null,
      getPrayerTimes: jest.fn(async () => {
        throw new Error("offline");
      }),
    });
    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();
    placeAt(JEDDAH_COORDS);
    await expect(
      usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true)
    ).rejects.toThrow();
    const api = jest.fn(serveNewPlace);
    usePrayerTimesStore.setState({ getPrayerTimes: api as never });

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();

    expect(api).toHaveBeenCalled();
    expect(oldPlaceDates()).toEqual([]);
    expect(usePrayerTimesStore.getState().timesCoords).toEqual(JEDDAH_COORDS);
  });

  // Those days are the default place's, not the newly verified one's.
  it("leaves unmarked days unmarked while the place is newly verified", async () => {
    usePrayerTimesStore.setState({
      timesCoords: null,
      usingDefaultLocation: true,
      getPrayerTimes: jest.fn(async () => {
        throw new Error("offline");
      }),
    });

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();

    expect(usePrayerTimesStore.getState().timesCoords).toBeNull();
  });

  it("keeps a newly verified place's refetch best effort", async () => {
    usePrayerTimesStore.setState({
      usingDefaultLocation: true,
      getPrayerTimes: jest.fn(async () => {
        throw new Error("offline");
      }),
    });

    await expect(usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace()).resolves.toBe(
      false
    );
  });

  // Unmarked days were fetched before this launch's fix took the place.
  describe("when the launch fix lands on unmarked days", () => {
    const place = locationStore.getState();
    const fixLandsAt = (coords: Coords) => {
      place.initializeLocation = async () => {
        placeAt(coords);
        place.lastKnownCoords = coords;
      };
    };
    const offline = () =>
      jest.fn(async () => {
        throw new Error("offline");
      });

    beforeEach(() => {
      place.locationMode = LocationMode.DEVICE;
      jest.mocked(checkLocationPermission).mockResolvedValue({ granted: true, canAskAgain: true });
      usePrayerTimesStore.setState({ timesCoords: null, didGetCurrentLocation: false });
    });

    afterEach(() => {
      place.lastKnownCoords = RIYADH_COORDS;
    });

    it("marks them with the place held before the fix", async () => {
      fixLandsAt(JEDDAH_COORDS);
      usePrayerTimesStore.setState({ getPrayerTimes: offline() });

      // The fix moved the place, so the old place's days must be refetched.
      await expect(usePrayerTimesStore.getState().loadPrayerTimes()).rejects.toThrow();

      expect(usePrayerTimesStore.getState().timesCoords).toEqual(RIYADH_COORDS);
    });

    it("refetches them for the place the fix moved to", async () => {
      fixLandsAt(JEDDAH_COORDS);
      const api = jest.fn(serveNewPlace);
      usePrayerTimesStore.setState({ getPrayerTimes: api as never });

      await usePrayerTimesStore.getState().loadPrayerTimes();

      expect(api).toHaveBeenCalled();
      expect(oldPlaceDates()).toEqual([]);
      expect(usePrayerTimesStore.getState().timesCoords).toEqual(JEDDAH_COORDS);
    });

    it("keeps them through a fix that drifts at the same place", async () => {
      fixLandsAt({
        latitude: RIYADH_COORDS.latitude + 0.0004,
        longitude: RIYADH_COORDS.longitude - 0.0003,
      });
      const api = offline();
      usePrayerTimesStore.setState({ getPrayerTimes: api });

      await expect(usePrayerTimesStore.getState().loadPrayerTimes()).resolves.toBe(true);

      expect(api).not.toHaveBeenCalled();
      expect(usePrayerTimesStore.getState().timesCoords).toEqual(RIYADH_COORDS);
    });

    // A cleared city leaves no verified place, but the days are still its own.
    it("refetches them on a later load when the place before was unverified", async () => {
      place.lastKnownCoords = null;
      fixLandsAt(JEDDAH_COORDS);
      usePrayerTimesStore.setState({ getPrayerTimes: offline() });
      await expect(usePrayerTimesStore.getState().loadPrayerTimes()).rejects.toThrow();
      const api = jest.fn(serveNewPlace);
      usePrayerTimesStore.setState({ getPrayerTimes: api as never });

      await usePrayerTimesStore.getState().loadPrayerTimes();

      expect(api).toHaveBeenCalled();
      expect(oldPlaceDates()).toEqual([]);
      expect(usePrayerTimesStore.getState().timesCoords).toEqual(JEDDAH_COORDS);
    });
  });
});

// The load and the background task fetch the same years after a move, and
// mark the place only once those years have landed.
describe.each([
  [
    "a load",
    () =>
      usePrayerTimesStore
        .getState()
        .loadPrayerTimesAtCurrentPlace()
        .catch(() => false),
  ],
  ["the background task", executeBackgroundRefresh],
])("a refetch after a move, by %s", (_caller, run) => {
  beforeEach(() => {
    usePrayerTimesStore.setState({ usingDefaultLocation: false, timesCoords: OLD_COORDS });
  });

  it.each([
    ["5 December", new Date(2026, 11, 5, 12), 2027, false],
    ["25 December", new Date(2026, 11, 25, 12), 2027, false],
    ["1 January", new Date(2027, 0, 1, 12), 2026, false],
    ["3 January", new Date(2027, 0, 3, 12), 2026, true],
  ])(
    "on %s, marks the place once the years it needs have landed",
    async (_day, today, adjacentYear, marksWithoutAdjacentYear) => {
      mockNow = today;
      storeOldPlace(today);
      usePrayerTimesStore.setState({ getPrayerTimes: serveNewPlaceExcept(adjacentYear) as never });

      await run();

      expect(usePrayerTimesStore.getState().timesCoords).toEqual(
        marksWithoutAdjacentYear ? RIYADH_COORDS : OLD_COORDS
      );

      usePrayerTimesStore.setState({ getPrayerTimes: jest.fn(serveNewPlace) as never });

      await run();

      expect(usePrayerTimesStore.getState().timesCoords).toEqual(RIYADH_COORDS);
      expect(oldPlaceDates()).toEqual([]);
    }
  );

  // A failed load leaves rows older than the kept days; the iOS widget reads
  // its zone from the oldest row.
  it("on 3 October, leaves the oldest stored row at the new place", async () => {
    mockNow = new Date(2026, 9, 3, 12);
    storeOldPlace(new Date(2026, 9, 1, 12));
    usePrayerTimesStore.setState({ getPrayerTimes: jest.fn(serveNewPlace) as never });

    await run();

    expect(mockTable.get(Math.min(...mockTable.keys()))?.timezone).toBe(NEW_ZONE);
  });
});

// A city pick starts its own load while an earlier one is still out; the
// earlier one answers for the old place.
describe("two forced loads across a city pick", () => {
  const FIRST_ZONE = RIYADH_ZONE;
  const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** The API; holds the first place's fetches of the years `holds` names. */
  const holdFirstPlace = (holds: (yearOverride?: number) => boolean = () => true) => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api = jest.fn(async (yearOverride?: number, month?: number) => {
      const served = servePlaceHeld(yearOverride, month);
      const { timezone } = locationStore.getState().locationDetails;
      if (timezone === FIRST_ZONE && holds(yearOverride)) await held;
      return served;
    });
    return { api, release };
  };

  /** Load A for the first place, a city pick, then load B for the second. */
  const pickDuringLoad = async (api: jest.Mock) => {
    placeAt(RIYADH_COORDS, FIRST_ZONE);
    usePrayerTimesStore.setState({ getPrayerTimes: api as never });
    const first = usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true);
    await nextTask();
    placeAt(SECOND_COORDS, SECOND_ZONE);
    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true);
    // Wrapped: an async function would wait for a promise it returns.
    return { first };
  };

  const expectSecondPlace = () => {
    const read = daysRead();
    expect(read).not.toContain(null);
    expect(read.map((day) => day?.timezone)).toEqual(read.map(() => SECOND_ZONE));
    expect(datesNotAt(SECOND_ZONE)).toEqual([]);
    expect(usePrayerTimesStore.getState().timesCoords).toEqual(SECOND_COORDS);
  };

  it("keeps the second place's days when the first load's fetch lands last", async () => {
    mockNow = new Date(2026, 8, 15, 12);
    storeOldPlace(mockNow);
    const { api, release } = holdFirstPlace();

    const { first } = await pickDuringLoad(api);
    release();
    await first;

    expectSecondPlace();
    expect(usePrayerTimesStore.getState().hasError).toBe(false);
  });

  // Load A's this-year days land before the pick; its next-year fetch, sent
  // for the first place, lands after load B ends.
  it("keeps them in December when the first load's next-year fetch lands last", async () => {
    mockNow = new Date(2026, 11, 5, 12);
    storeOldPlace(mockNow);
    const { api, release } = holdFirstPlace((yearOverride) => yearOverride !== undefined);

    const { first } = await pickDuringLoad(api);
    release();
    await first;

    expect(api.mock.calls.map(([year]) => year)).toEqual([undefined, 2027, undefined, 2027]);
    expectSecondPlace();
    expect(usePrayerTimesStore.getState().hasError).toBe(false);
  });
});

// The read-ahead window crosses into next year from 19 December.
describe("an unforced load in December at the same place", () => {
  /** This place's kept and read days around `today`, this year's only. */
  const storeThisYear = (today: Date) => {
    mockTable.clear();
    for (let offset = -2; offset <= 13; offset += 1) {
      const day = addDays(today, offset);
      if (day.getFullYear() === today.getFullYear()) {
        mockTable.set(dateToInt(day), row(day, NEW_ZONE));
      }
    }
  };

  beforeEach(() => {
    usePrayerTimesStore.setState({ usingDefaultLocation: false, timesCoords: RIYADH_COORDS });
  });

  it("fetches next year's days the window reads, resolving true", async () => {
    mockNow = new Date(2026, 11, 20, 12);
    storeThisYear(mockNow);
    const api = jest.fn(serveNewPlace);
    usePrayerTimesStore.setState({ getPrayerTimes: api as never });

    await expect(usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace()).resolves.toBe(
      true
    );

    expect(api.mock.calls.map(([year]) => year)).toEqual([2027]);
    expect(usePrayerTimesStore.getState().twoWeeksTimings).toHaveLength(14);
  });

  it("keeps the stored days, resolving false, when that fetch fails", async () => {
    mockNow = new Date(2026, 11, 20, 12);
    storeThisYear(mockNow);
    usePrayerTimesStore.setState({ getPrayerTimes: serveNewPlaceExcept(2027) as never });

    await expect(usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace()).resolves.toBe(
      false
    );

    expect(daysRead()).not.toContain(null);
    expect(usePrayerTimesStore.getState().hasError).toBe(false);
  });

  // A settings apply during that fetch must not lose to its late write.
  it("lets a load started during that fetch store next year's days last", async () => {
    mockNow = new Date(2026, 11, 20, 12);
    storeThisYear(mockNow);
    let land = () => {};
    const late = new Promise<void>((resolve) => {
      land = resolve;
    });
    const stale = jest.fn(async (yearOverride?: number, month?: number) => {
      await late;
      const served = await serveNewPlace(yearOverride, month);
      return { ...served, days: served.days.map((day) => ({ ...day, timezone: OLD_ZONE })) };
    });
    const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
    usePrayerTimesStore.setState({ getPrayerTimes: stale as never });
    const launch = usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();
    await nextTask();
    usePrayerTimesStore.setState({ getPrayerTimes: jest.fn(serveNewPlace) as never });
    const forced = usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true);
    await nextTask();

    land();
    await Promise.all([launch, forced]);

    expect(stale).toHaveBeenCalledTimes(1);
    expect(oldPlaceDates()).toEqual([]);
  });

  it("asks for no year while the window stays in this year", async () => {
    mockNow = new Date(2026, 11, 5, 12);
    storeThisYear(mockNow);
    const api = jest.fn(serveNewPlace);
    usePrayerTimesStore.setState({ getPrayerTimes: api as never });

    await expect(usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace()).resolves.toBe(
      true
    );

    expect(api).not.toHaveBeenCalled();
  });
});
