import type { TFunction } from "i18next";

import {
  QUIET_BAR_STEP_SECONDS,
  QUIET_ENDING_SECONDS,
  QUIET_EVENT,
  QUIET_PHASE,
  QUIET_SIGNAL,
  QUIET_TIME_SECONDS,
  TASK_CLOCK_MAX_GAIN_MS,
  WAY_OUT_SOUNDING_SECONDS,
  type QuietEvent,
  type QuietPhase,
  type QuietSignal,
} from "@/constants/WakeTaskShell";

const SECOND_MS = 1000;
const SECONDS_PER_MINUTE = 60;

/** Each quiet time's length; a screen reader gets the longer one. */
export const quietSecondsFor = (screenReader: boolean): number =>
  screenReader ? QUIET_TIME_SECONDS.SCREEN_READER : QUIET_TIME_SECONDS.DEFAULT;

/** Quiet time and the sounding time counted so far, in epoch ms. */
export type TaskClock = Readonly<{
  /** When the current quiet time ends. */
  quietUntil: number;
  /** The current quiet time's full length. */
  quietMs: number;
  /** Time the alarm has sounded while the task was open. */
  soundingMs: number;
  /** The moment sounding time is counted up to. */
  countedTo: number;
}>;

/** A clock whose quiet time starts as the task opens. */
export const startTaskClock = (now: number, quietMs: number): TaskClock => ({
  quietUntil: now + quietMs,
  quietMs,
  soundingMs: 0,
  countedTo: now,
});

// Counts sounding time to `now` only after a read that found quiet over,
// a short stretch per read at most, and none while the alarm is unheard.
export const advanceTaskClock = (clock: TaskClock, now: number, audible: boolean): TaskClock => {
  if (now <= clock.countedTo) return clock;
  const sounding = audible && clock.countedTo >= clock.quietUntil;
  const gained = sounding ? Math.min(now - clock.countedTo, TASK_CLOCK_MAX_GAIN_MS) : 0;
  return { ...clock, soundingMs: clock.soundingMs + gained, countedTo: now };
};

/** A full quiet time from `now`, once the time before it is counted. */
export const restartQuiet = (
  clock: TaskClock,
  now: number,
  quietMs: number,
  audible: boolean
): TaskClock => ({ ...advanceTaskClock(clock, now, audible), quietUntil: now + quietMs, quietMs });

/** Ends quiet time at `now`, once the time before it is counted. */
export const endQuiet = (clock: TaskClock, now: number, audible: boolean): TaskClock => {
  const counted = advanceTaskClock(clock, now, audible);
  return { ...counted, quietUntil: Math.min(counted.quietUntil, now) };
};

/** A saved clock reopened at `now`; its closed time counts for nothing. */
export const resumeTaskClock = (clock: TaskClock, now: number): TaskClock => ({
  ...clock,
  countedTo: Math.max(clock.countedTo, now),
});

const quietLeftMs = (clock: TaskClock, now: number) => Math.max(0, clock.quietUntil - now);

export const quietPhase = (clock: TaskClock, now: number): QuietPhase => {
  const left = quietLeftMs(clock, now);
  if (left === 0) return QUIET_PHASE.SOUNDING;
  return left <= QUIET_ENDING_SECONDS * SECOND_MS ? QUIET_PHASE.ENDING : QUIET_PHASE.PAUSED;
};

export const quietSecondsLeft = (clock: TaskClock, now: number): number =>
  Math.ceil(quietLeftMs(clock, now) / SECOND_MS);

/** How full the quiet bar is, 0 to 1; `stepped` holds it between steps. */
export const quietFraction = (clock: TaskClock, now: number, stepped: boolean): number => {
  const step = QUIET_BAR_STEP_SECONDS * SECOND_MS;
  const left = quietLeftMs(clock, now);
  const shown = stepped ? Math.ceil(left / step) * step : left;
  return Math.min(1, shown / clock.quietMs);
};

/** A clock and the moment it was last read. */
export type ClockReading = Readonly<{ clock: TaskClock; now: number }>;

export type QuietStep = Readonly<{ reading: ClockReading; signal: QuietSignal | null }>;

const tickSignal = (was: QuietPhase, is: QuietPhase): QuietSignal | null => {
  if (is === was) return null;
  if (is === QUIET_PHASE.ENDING) return QUIET_SIGNAL.ENDING;
  return is === QUIET_PHASE.SOUNDING ? QUIET_SIGNAL.END : null;
};

/** What one event does to a run's quiet time, and the sound change it calls
 *  for; an unheard alarm gets none. */
export const stepQuiet = (
  before: ClockReading,
  event: QuietEvent,
  now: number,
  quietMs: number,
  audible: boolean
): QuietStep => {
  const was = quietPhase(before.clock, before.now);
  const sounding = was === QUIET_PHASE.SOUNDING;
  switch (event) {
    case QUIET_EVENT.OPEN:
      return { reading: before, signal: audible && !sounding ? QUIET_SIGNAL.START : null };
    case QUIET_EVENT.TICK: {
      const clock = advanceTaskClock(before.clock, now, audible);
      const signal = audible ? tickSignal(was, quietPhase(clock, now)) : null;
      return { reading: { clock, now }, signal };
    }
    case QUIET_EVENT.HEAR:
      return { reading: { clock: endQuiet(before.clock, now, false), now }, signal: null };
    case QUIET_EVENT.RESTART:
      return {
        reading: { clock: restartQuiet(before.clock, now, quietMs, audible), now },
        signal: audible && sounding ? QUIET_SIGNAL.START : null,
      };
    case QUIET_EVENT.LEAVE:
      return {
        reading: { clock: endQuiet(before.clock, now, audible), now },
        signal: audible && !sounding ? QUIET_SIGNAL.END : null,
      };
    default: {
      const unhandled: never = event;
      throw new Error(`unknown quiet event ${String(unhandled)}`);
    }
  }
};

export const wayOutShown = (clock: TaskClock): boolean =>
  clock.soundingMs >= WAY_OUT_SOUNDING_SECONDS * SECOND_MS;

/** When the way out appears, in minutes; callers localise its digits. */
export const wayOutSentence = (t: TFunction): string =>
  t("alarm.task.wayOutAfter", {
    count: WAY_OUT_SOUNDING_SECONDS / SECONDS_PER_MINUTE,
    stop: t("alarm.task.stop"),
  });
