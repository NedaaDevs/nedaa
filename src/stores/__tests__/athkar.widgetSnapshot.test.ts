const mockSync = jest.fn(async () => {});
jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: () => mockSync() }));

const mockCheckAndMark = jest.fn<Promise<void>, [number, string]>(async () => {});
const mockGetStreak = jest.fn<Promise<null>, []>(async () => null);
jest.mock("@/services/athkar-db", () => ({
  AthkarDB: {
    checkAndMarkSessionComplete: (dateInt: number, session: string) =>
      mockCheckAndMark(dateInt, session),
    areBothSessionsCompleted: jest.fn(async () => false),
    updateStreakForDay: jest.fn(async () => {}),
    getStreakData: () => mockGetStreak(),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

// eslint-disable-next-line import/first -- imports must follow jest.mock hoisting
import { useAthkarStore } from "@/stores/athkar";

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe("athkar store → widget snapshot", () => {
  test("syncs after the debounced session write lands, not before", async () => {
    useAthkarStore.getState().checkAndUpdateSessionCompletion("ayat-kursi-morning");

    expect(mockSync).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(600);
    // The debounce callback reaches the writer through a dynamic import; drain that chain.
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCheckAndMark).toHaveBeenCalledWith(expect.any(Number), "morning");
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  test("syncs after the streak is reloaded", async () => {
    await useAthkarStore.getState().reloadStreakFromDB();
    expect(mockGetStreak).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledTimes(1);
  });
});
