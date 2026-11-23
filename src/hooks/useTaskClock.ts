import { useEffect, useEffectEvent, useRef, useState } from "react";

import { QUIET_PHASE, TASK_CLOCK_TICK_MS } from "@/constants/WakeTaskShell";
import {
  advanceTaskClock,
  endQuiet,
  quietFraction,
  quietPhase,
  quietSecondsLeft,
  restartQuiet as restartQuietAt,
  resumeTaskClock,
  startTaskClock,
  wayOutShown,
  type TaskClock,
} from "@/utils/taskClock";

type Options = {
  /** When the task opened, in epoch ms; a new run's quiet time starts there. */
  openedAt: number;
  /** The clock a left run saved; it reopens without a new quiet time. */
  resume?: TaskClock;
  quietMs: number;
  /** False while the alarm cannot sound, e.g. snoozed: no time counts, and
   *  no callback fires. */
  audible: boolean;
  /** Moves the quiet bar in whole steps. */
  stepped: boolean;
  onQuietStart: () => void;
  onQuietEnding?: () => void;
  onQuietEnd: () => void;
};

type Reading = Readonly<{ clock: TaskClock; now: number }>;

/** One task run's quiet time, and the sounding time that earns the way out. */
export const useTaskClock = ({
  openedAt,
  resume,
  quietMs,
  audible,
  stepped,
  onQuietStart,
  onQuietEnding,
  onQuietEnd,
}: Options) => {
  const [reading, setReading] = useState<Reading>(() => ({
    clock: resume ? resumeTaskClock(resume, openedAt) : startTaskClock(openedAt, quietMs),
    now: openedAt,
  }));
  // The reading the callbacks were last sent for; handlers and effects read it.
  const latest = useRef(reading);

  const commit = (next: Reading) => {
    latest.current = next;
    setReading(next);
  };

  const tick = useEffectEvent(() => {
    const before = latest.current;
    const now = Date.now();
    const clock = advanceTaskClock(before.clock, now, audible);
    const next = { clock, now };
    // An unheard run shows no reading, so its ticks draw nothing.
    if (audible) commit(next);
    else latest.current = next;

    const was = quietPhase(before.clock, before.now);
    const is = quietPhase(clock, now);
    if (is === was || !audible) return;
    if (is === QUIET_PHASE.ENDING) onQuietEnding?.();
    if (is === QUIET_PHASE.SOUNDING) onQuietEnd();
  });

  const open = useEffectEvent(() => {
    const { clock, now } = latest.current;
    if (audible && quietPhase(clock, now) !== QUIET_PHASE.SOUNDING) onQuietStart();
  });

  useEffect(() => {
    open();
    const id = setInterval(tick, TASK_CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  /** A full quiet time from now; pauses the sound if it had returned. */
  const restartQuiet = () => {
    const before = latest.current;
    const now = Date.now();
    commit({ clock: restartQuietAt(before.clock, now, quietMs, audible), now });
    if (audible && quietPhase(before.clock, before.now) === QUIET_PHASE.SOUNDING) onQuietStart();
  };

  /** Ends quiet time as the task closes; returns the clock to resume from. */
  const leave = (): TaskClock => {
    const before = latest.current;
    const now = Date.now();
    const clock = endQuiet(before.clock, now, audible);
    commit({ clock, now });
    if (audible && quietPhase(before.clock, before.now) !== QUIET_PHASE.SOUNDING) onQuietEnd();
    return clock;
  };

  const { clock, now } = reading;
  return {
    phase: quietPhase(clock, now),
    secondsLeft: quietSecondsLeft(clock, now),
    fraction: quietFraction(clock, now, stepped),
    wayOut: wayOutShown(clock),
    restartQuiet,
    leave,
  };
};
