import { useAlarmStreakStore } from "@/stores/alarmStreak";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const MINUTE = 60 * 1000;

beforeEach(() => {
  useAlarmStreakStore.setState({ streak: 0, lastSuccessDate: null, bestStreak: 0 });
});

describe("recordFajrSuccess", () => {
  it("counts a challenge solved soon after the alarm rang", () => {
    useAlarmStreakStore.getState().recordFajrSuccess(Date.now() - 5 * MINUTE);

    expect(useAlarmStreakStore.getState().streak).toBe(1);
  });

  it("does not count a challenge solved before the alarm was due", () => {
    useAlarmStreakStore.getState().recordFajrSuccess(Date.now() + 60 * MINUTE);

    expect(useAlarmStreakStore.getState().streak).toBe(0);
  });
});
