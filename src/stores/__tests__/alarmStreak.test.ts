import Storage from "expo-sqlite/kv-store";
import { ALARM_OUTCOME, type AlarmOutcome } from "expo-alarm";

import { useAlarmStreakStore } from "@/stores/alarmStreak";
import { toLocalDateISO } from "@/utils/streak";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const MINUTE = 60 * 1000;

/** Fajr time on day n of a run of mornings, local time. */
const morningOf = (day: number) => new Date(2026, 10, 19 + day, 5, 0).getTime();
const dateOf = (day: number) => toLocalDateISO(morningOf(day));

/** An alarm that rang on `day`, ended `after` its trigger. */
const endOn = (day: number, outcome: AlarmOutcome, after = 5 * MINUTE) => {
  jest.setSystemTime(morningOf(day) + after);
  useAlarmStreakStore.getState().recordFajrOutcome(morningOf(day), outcome);
};
const solveOn = (day: number) => endOn(day, ALARM_OUTCOME.SOLVED);

afterEach(() => jest.useRealTimers());

beforeEach(() => {
  jest.useFakeTimers({ now: morningOf(1) });
  useAlarmStreakStore.setState({
    streak: 0,
    lastSuccessDate: null,
    lastHeldDate: null,
    bestStreak: 0,
  });
});

describe("recordFajrOutcome", () => {
  it("counts a challenge solved soon after the alarm rang", () => {
    useAlarmStreakStore.getState().recordFajrOutcome(Date.now() - 5 * MINUTE, ALARM_OUTCOME.SOLVED);

    expect(useAlarmStreakStore.getState().streak).toBe(1);
  });

  it("does not count a challenge solved before the alarm was due", () => {
    useAlarmStreakStore
      .getState()
      .recordFajrOutcome(Date.now() + 60 * MINUTE, ALARM_OUTCOME.SOLVED);

    expect(useAlarmStreakStore.getState().streak).toBe(0);
  });

  it("neither grows nor ends the streak for a stopped alarm", () => {
    solveOn(1);
    endOn(2, ALARM_OUTCOME.STOPPED);
    solveOn(3);

    expect(useAlarmStreakStore.getState().streak).toBe(2);
  });

  it("does not record a stop past the hour, so that morning is missed", () => {
    useAlarmStreakStore.setState({ streak: 3, bestStreak: 3, lastSuccessDate: dateOf(1) });

    endOn(2, ALARM_OUTCOME.STOPPED, 61 * MINUTE);
    solveOn(3);

    expect(useAlarmStreakStore.getState()).toMatchObject({ streak: 1, lastHeldDate: null });
  });

  it("grows a saved streak held through a stopped morning", async () => {
    jest.mocked(Storage.getItem).mockResolvedValueOnce(
      JSON.stringify({
        state: { streak: 3, lastSuccessDate: dateOf(1), lastHeldDate: dateOf(2), bestStreak: 3 },
        version: 0,
      })
    );
    await useAlarmStreakStore.persist.rehydrate();

    solveOn(3);

    expect(useAlarmStreakStore.getState()).toMatchObject({ streak: 4, bestStreak: 4 });
  });

  // A saved streak without lastHeldDate reads it as null.
  it("reads a saved streak without a held day", async () => {
    jest.mocked(Storage.getItem).mockResolvedValueOnce(
      JSON.stringify({
        state: { streak: 3, lastSuccessDate: dateOf(1), bestStreak: 3 },
        version: 0,
      })
    );

    await useAlarmStreakStore.persist.rehydrate();

    expect(useAlarmStreakStore.getState()).toMatchObject({ streak: 3, lastHeldDate: null });
  });
});
