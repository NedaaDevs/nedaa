/* eslint-disable import/first -- imports follow the jest.mock calls they need */
jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: jest.fn(async () => {}) }));
jest.mock("@/services/athkar-db", () => ({ AthkarDB: {} }));
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

import { act, renderHook } from "@testing-library/react-native";
import { useAthkarLandingScreenshotSeed } from "@/components/athkar/useAthkarScreenshotSeed";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { getPreset } from "@/screenshot-mode/presets";
import { useAthkarStore } from "@/stores/athkar";
import { useScreenshotStore } from "@/stores/screenshotStore";

const SEED_NAME = "morning-3-of-10";
const SEED = getPreset("athkar", SEED_NAME);

const MORNING = Array.from({ length: 12 }, (_, index) => ({
  id: `${index + 1}-morning`,
  title: "",
  text: "",
  count: 1,
  type: ATHKAR_TYPE.MORNING,
  order: index + 1,
}));

const EMPTY_STREAK = {
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
  isPaused: false,
  toleranceDays: 0,
};

const done = () => useAthkarStore.getState().currentProgress.filter((p) => p.completed).length;

describe("useAthkarLandingScreenshotSeed", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useAthkarStore.setState({ morningAthkarList: MORNING, currentProgress: [] });
    useScreenshotStore.getState().setShot({
      screen: "athkar",
      locale: "en",
      seed: SEED_NAME,
      payload: SEED ?? {},
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    useScreenshotStore.getState().reset();
  });

  it("shows the seeded progress and streak", async () => {
    await renderHook(() => useAthkarLandingScreenshotSeed());

    expect(useAthkarStore.getState().morningAthkarList).toHaveLength(SEED?.progress.total ?? 0);
    expect(done()).toBe(SEED?.progress.completed);
    expect(useAthkarStore.getState().streak.currentStreak).toBeGreaterThan(0);
  });

  // The session reads today's progress from the database after the screen mounts.
  it("keeps the seed after the session reloads from the database", async () => {
    await renderHook(() => useAthkarLandingScreenshotSeed());
    await act(() => jest.advanceTimersByTime(5000));

    await act(() =>
      useAthkarStore.setState({
        morningAthkarList: MORNING,
        currentProgress: [],
        streak: EMPTY_STREAK,
      })
    );

    expect(useAthkarStore.getState().morningAthkarList).toHaveLength(SEED?.progress.total ?? 0);
    expect(done()).toBe(SEED?.progress.completed);
    expect(useAthkarStore.getState().streak.currentStreak).toBeGreaterThan(0);
  });
});
