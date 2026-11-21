import { ALARM_OUTCOME, type AlarmOutcome } from "expo-alarm";

import { computeNextStreak, daysBetweenISO } from "@/utils/streak";

/** Fajr mornings woken in a row, as YYYY-MM-DD local dates. */
export type FajrStreak = Readonly<{
  streak: number;
  bestStreak: number;
  lastSuccessDate: string | null;
  /** The last stopped morning that kept the streak going. */
  lastHeldDate: string | null;
}>;

/** The later of the two days the streak runs on from. */
const lastCountedDate = ({ lastSuccessDate, lastHeldDate }: FajrStreak): string | null =>
  lastHeldDate && (!lastSuccessDate || lastHeldDate > lastSuccessDate)
    ? lastHeldDate
    : lastSuccessDate;

// A stop holds today only on an unbroken chain, so a solve after it grows.
const solved = (state: FajrStreak, todayISO: string): FajrStreak => {
  const heldToday = state.lastHeldDate === todayISO && state.lastSuccessDate !== todayISO;
  const streak = heldToday
    ? state.streak + 1
    : computeNextStreak(lastCountedDate(state), todayISO, state.streak);
  return {
    ...state,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    lastSuccessDate: todayISO,
  };
};

// A stop keeps a streak alive to today; one a missed morning broke stays so.
const stopped = (state: FajrStreak, todayISO: string): FajrStreak => {
  const last = lastCountedDate(state);
  if (state.streak === 0 || !last) return state;
  const gap = daysBetweenISO(last, todayISO);
  return gap === 0 || gap === 1 ? { ...state, lastHeldDate: todayISO } : state;
};

/** An outcome this build does not know, from a newer native side. */
const unknownOutcome = (_outcome: never, state: FajrStreak): FajrStreak => state;

/** A solve grows the streak, a stop holds it, an abandoned alarm leaves it. */
export const nextFajrStreak = (
  state: FajrStreak,
  outcome: AlarmOutcome,
  todayISO: string
): FajrStreak => {
  switch (outcome) {
    case ALARM_OUTCOME.SOLVED:
      return solved(state, todayISO);
    case ALARM_OUTCOME.STOPPED:
      return stopped(state, todayISO);
    case ALARM_OUTCOME.ABANDONED:
      return state;
    default:
      return unknownOutcome(outcome, state);
  }
};
