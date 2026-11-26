import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  QUIET_EVENT,
  QUIET_SIGNAL,
  TASK_CLOCK_TICK_MS,
  type QuietEvent,
} from "@/constants/WakeTaskShell";
import {
  quietFraction,
  quietPhase,
  quietSecondsLeft,
  resumeTaskClock,
  startTaskClock,
  stepQuiet,
  wayOutShown,
  type ClockReading,
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
  const [reading, setReading] = useState<ClockReading>(() => ({
    clock: resume ? resumeTaskClock(resume, openedAt) : startTaskClock(openedAt, quietMs),
    now: openedAt,
  }));
  // The reading the callbacks were last sent for; handlers and effects read it.
  const latest = useRef(reading);

  // Applies one event at the current time and sends the sound change it calls for.
  const run = (event: QuietEvent): TaskClock => {
    const before = latest.current;
    const { reading: next, signal } = stepQuiet(before, event, Date.now(), quietMs, audible);
    if (next !== before) {
      latest.current = next;
      // An unheard run shows no reading, so its ticks draw nothing.
      if (audible || event !== QUIET_EVENT.TICK) setReading(next);
    }
    if (signal === QUIET_SIGNAL.START) onQuietStart();
    if (signal === QUIET_SIGNAL.ENDING) onQuietEnding?.();
    if (signal === QUIET_SIGNAL.END) onQuietEnd();
    return next.clock;
  };

  const tick = useEffectEvent(() => run(QUIET_EVENT.TICK));
  const open = useEffectEvent(() => run(QUIET_EVENT.OPEN));

  useEffect(() => {
    open();
    const id = setInterval(tick, TASK_CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // The alarm sounds again as it becomes audible, so quiet time ends with it.
  const heard = useRef(audible);
  const hear = useEffectEvent(() => run(QUIET_EVENT.HEAR));

  useEffect(() => {
    if (audible && !heard.current) hear();
    heard.current = audible;
  }, [audible]);

  /** A full quiet time from now; pauses the sound if it had returned. */
  const restartQuiet = () => {
    run(QUIET_EVENT.RESTART);
  };

  /** Ends quiet time as the task closes; returns the clock to resume from. */
  const leave = (): TaskClock => run(QUIET_EVENT.LEAVE);

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
