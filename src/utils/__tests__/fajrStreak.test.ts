import { ALARM_OUTCOME, type AlarmOutcome } from "expo-alarm";

import { nextFajrStreak, type FajrStreak } from "@/utils/fajrStreak";

const DAY_1 = "2026-11-20";
const DAY_2 = "2026-11-21";
const DAY_3 = "2026-11-22";
const DAY_5 = "2026-11-24";

/** Four mornings woken, the last on day 1. */
const FOUR: FajrStreak = { streak: 4, bestStreak: 4, lastSuccessDate: DAY_1, lastHeldDate: null };

const solveOn = (state: FajrStreak, day: string) =>
  nextFajrStreak(state, ALARM_OUTCOME.SOLVED, day);

describe("nextFajrStreak", () => {
  // Each outcome on day 2, then a solve on day 3, through the same function.
  it.each([
    { outcome: ALARM_OUTCOME.SOLVED, onDay2: 5, onDay3: 6 },
    { outcome: ALARM_OUTCOME.STOPPED, onDay2: 4, onDay3: 5 },
    { outcome: ALARM_OUTCOME.ABANDONED, onDay2: 4, onDay3: 1 },
  ])("$outcome on day 2 leaves $onDay2, then a solve leaves $onDay3", (case_) => {
    const day2 = nextFajrStreak(FOUR, case_.outcome, DAY_2);
    const day3 = solveOn(day2, DAY_3);

    expect(day2.streak).toBe(case_.onDay2);
    expect(day3.streak).toBe(case_.onDay3);
  });

  it("grows the best streak only on a solve", () => {
    expect(solveOn(FOUR, DAY_2).bestStreak).toBe(5);
    expect(nextFajrStreak(FOUR, ALARM_OUTCOME.STOPPED, DAY_2).bestStreak).toBe(4);
  });

  it("keeps a streak through stopped mornings in a row", () => {
    const held = [DAY_2, DAY_3].reduce(
      (state, day) => nextFajrStreak(state, ALARM_OUTCOME.STOPPED, day),
      FOUR
    );

    expect(solveOn(held, "2026-11-23").streak).toBe(5);
  });

  it("counts a stop and a solve on one day the same in either order", () => {
    const stop = (state: FajrStreak) => nextFajrStreak(state, ALARM_OUTCOME.STOPPED, DAY_2);
    const stopThenSolve = solveOn(stop(FOUR), DAY_2);

    expect(stopThenSolve).toEqual(stop(solveOn(FOUR, DAY_2)));
    expect(stopThenSolve.streak).toBe(FOUR.streak + 1);
  });

  it("keeps the last solved day when a stop holds the streak", () => {
    expect(nextFajrStreak(FOUR, ALARM_OUTCOME.STOPPED, DAY_2)).toEqual({
      ...FOUR,
      lastHeldDate: DAY_2,
    });
  });

  it("brings back no streak a missed morning already broke", () => {
    const stopped = nextFajrStreak(FOUR, ALARM_OUTCOME.STOPPED, DAY_5);

    expect(stopped).toEqual(FOUR);
    expect(solveOn(stopped, "2026-11-25").streak).toBe(1);
  });

  it("starts no streak from a stop", () => {
    const none: FajrStreak = {
      streak: 0,
      bestStreak: 0,
      lastSuccessDate: null,
      lastHeldDate: null,
    };

    expect(nextFajrStreak(none, ALARM_OUTCOME.STOPPED, DAY_2)).toEqual(none);
  });

  // Native writes the outcome; a newer build may write one this build lacks.
  it("keeps the streak for an outcome it does not know", () => {
    const unknown = "unknown-outcome" as unknown as AlarmOutcome;

    expect(nextFajrStreak(FOUR, unknown, DAY_2)).toEqual(FOUR);
  });
});
