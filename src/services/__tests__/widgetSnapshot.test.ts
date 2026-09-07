// Each mock carries its argument tuple, so the call assertions below typecheck.
type AthkarStub = {
  morning: { completed: number; total: number; completedAt: string | null };
  evening: { completed: number; total: number; completedAt: string | null };
  streak: { current: number; longest: number };
};

const mockWriteSnapshotFile = jest.fn<Promise<void>, [unknown]>(async () => {});
jest.mock("@/services/widgetSnapshotFile", () => ({
  ...jest.requireActual("@/services/widgetSnapshotFile"),
  writeSnapshotFile: (s: unknown) => mockWriteSnapshotFile(s),
}));

const mockRefreshAllWidgets = jest.fn<Promise<void>, []>(async () => {});
jest.mock("../../../modules/expo-widgets/src", () => ({
  refreshAllWidgets: () => mockRefreshAllWidgets(),
}));

const mockGetByRange = jest.fn<Promise<unknown[]>, [number, number]>(async () => []);
jest.mock("@/services/db", () => ({
  PrayerTimesDB: {
    getPrayerTimesByDateRange: (start: number, end: number) => mockGetByRange(start, end),
  },
}));
const mockAthkar = jest.fn<Promise<AthkarStub>, [number]>(async () => ({
  morning: { completed: 0, total: 0, completedAt: null },
  evening: { completed: 0, total: 0, completedAt: null },
  streak: { current: 0, longest: 0 },
}));
jest.mock("@/services/athkar-db", () => ({
  AthkarDB: { getWidgetSnapshotData: (d: number) => mockAthkar(d) },
}));
const mockQadaCount = jest.fn<Promise<number>, [string, string]>(async () => 2);
jest.mock("@/services/qada-db", () => ({
  QadaDB: {
    getCompletedCountBetween: (startIso: string, endIso: string) => mockQadaCount(startIso, endIso),
  },
}));
jest.mock("@/services/widgetPayloads", () => ({
  buildHijriTodayPayload: () => ({ hijriLabel: "H" }),
  buildImportantDaysPayload: () => [],
}));
jest.mock("@/stores/app", () => ({ useAppStore: { getState: () => ({ hijriDaysOffset: 1 }) } }));
jest.mock("@/stores/location", () => ({
  useLocationStore: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock("@/stores/preferences", () => ({
  usePreferencesStore: { getState: () => ({ useWesternNumerals: true }) },
}));
jest.mock("@/stores/qada", () => ({
  useQadaStore: { getState: () => ({ totalMissed: 7, totalCompleted: 3 }) },
}));
jest.mock("@/localization/i18n", () => ({ __esModule: true, default: { t: (k: string) => k } }));
// The module under test calls AppLogger.create() at import time, before an outer
// const would be initialised, so the stub is built inside the factory and read back
// through the mocked import.
jest.mock("@/utils/appLogger", () => {
  const stub = { i: jest.fn(), w: jest.fn(), e: jest.fn() };
  return { AppLogger: { create: () => stub } };
});

// eslint-disable-next-line import/first -- imports must follow jest.mock hoisting
import { Platform } from "react-native";
// eslint-disable-next-line import/first
import { syncWidgetSnapshot, writeWidgetSnapshot } from "@/services/widgetSnapshot";
// eslint-disable-next-line import/first
import { AppLogger } from "@/utils/appLogger";

const mockLog = AppLogger.create("widgets") as unknown as {
  i: jest.Mock;
  w: jest.Mock;
  e: jest.Mock;
};

// jest-expo pins Platform.OS per preset; the module under test branches on it, so each
// test sets it explicitly rather than depending on which preset ran.
const setPlatform = (os: "android" | "ios") => {
  (Platform as { OS: string }).OS = os;
};

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform("android");
  jest.useFakeTimers().setSystemTime(Date.parse("2026-09-06T01:00:00Z"));
});
afterEach(() => jest.useRealTimers());

describe("writeWidgetSnapshot", () => {
  test("gathers from both databases and the stores, then writes", async () => {
    await writeWidgetSnapshot();

    expect(mockGetByRange).toHaveBeenCalledWith(20260906, 20260908);
    expect(mockAthkar).toHaveBeenCalledWith(20260906);
    expect(mockQadaCount).toHaveBeenCalledWith(
      "2026-09-05T21:00:00.000Z",
      "2026-09-06T21:00:00.000Z"
    );
    expect(mockWriteSnapshotFile).toHaveBeenCalledTimes(1);
    const written = mockWriteSnapshotFile.mock.calls[0][0] as { config: unknown; qada: unknown };
    expect(written.config).toEqual({
      useWesternNumerals: true,
      timezone: "Asia/Riyadh",
      hijriDaysOffset: 1,
    });
    expect(written.qada).toEqual({
      date: 20260906,
      totalMissed: 7,
      totalCompleted: 3,
      completedToday: 2,
    });
  });

  test("is a no-op off Android", async () => {
    setPlatform("ios");
    await writeWidgetSnapshot();
    expect(mockGetByRange).not.toHaveBeenCalled();
    expect(mockWriteSnapshotFile).not.toHaveBeenCalled();
  });

  test("never throws: a failed write is logged and the previous file stays", async () => {
    mockWriteSnapshotFile.mockRejectedValueOnce(new Error("disk full"));
    await expect(writeWidgetSnapshot()).resolves.toBeUndefined();
    expect(mockLog.e).toHaveBeenCalledWith("Snapshot", expect.any(String), expect.any(Error));
  });
});

describe("syncWidgetSnapshot", () => {
  test("writes, then repaints Android", async () => {
    await syncWidgetSnapshot();
    expect(mockWriteSnapshotFile).toHaveBeenCalledTimes(1);
    expect(mockRefreshAllWidgets).toHaveBeenCalledTimes(1);
  });

  test("does nothing on iOS — the WidgetKit reload budget is not touched", async () => {
    setPlatform("ios");
    await syncWidgetSnapshot();
    expect(mockRefreshAllWidgets).not.toHaveBeenCalled();
  });
});
