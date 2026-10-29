import { use, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, type HostInstance } from "react-native";
import { parseISO } from "date-fns";

import { BrightnessTheme } from "@/components/ui/brightness-theme";
import { Button } from "@/components/ui/button";
import { APP_STATE } from "@/constants/AppState";
import {
  DAY_RUN,
  DAY_RUN_DEBUG_LABEL,
  DAY_RUN_KIND,
  DAY_RUN_PACE,
  DAY_RUN_STATUS,
  type DayRunKind,
} from "@/constants/DayRun";
import { PHASE } from "@/constants/Phase";
import { PRAYER_ID } from "@/constants/Prayer";
import { DayRunContext, useDayRun, type DayRun } from "@/contexts/DayRunContext";
import { DrawnModeContext } from "@/contexts/DrawnModeContext";
import { PhaseContext, usePhase } from "@/contexts/PhaseContext";
import { useAppScheme } from "@/contexts/SchemeContext";
import { AppMode } from "@/enums/app";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SampleDaysContext } from "@/hooks/useStoredDays";
import { SimulatedClockContext, useClockOverride } from "@/hooks/useTodayClock";
import { useTodayStored } from "@/hooks/useTodayStored";
import { useAppStore } from "@/stores/app";
import { useDebugModeStore } from "@/stores/debugMode";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { focusOn } from "@/utils/accessibilityFocus";
import { isDarkMode } from "@/utils/appearance";
import {
  dayRunClockAt,
  dayRunLengthMs,
  dayRunPhaseStartMs,
  dayRunSchedule,
  type DayRunSchedule,
} from "@/utils/dayRun";
import { phaseAt, type StoredDays } from "@/utils/phase";
import { sampleDays } from "@/utils/sampleDays";

/** The statuses of a started run; IDLE is no run at all. */
type RunStatus =
  typeof DAY_RUN_STATUS.PLAYING | typeof DAY_RUN_STATUS.PAUSED | typeof DAY_RUN_STATUS.ENDED;

/** A started run: its days and schedule, fixed at start, and how far it is. */
type Run = {
  days: StoredDays;
  schedule: DayRunSchedule;
  status: RunStatus;
  elapsedMs: number;
};

/** A run through the stored day, from before its Fajr to the next one. */
const runSchedule = (days: StoredDays): DayRunSchedule | null => {
  if (!days.today) return null;
  // Just before today's Fajr, so a run plays today even after Fajr has passed.
  const fajr = parseISO(days.today.timings[PRAYER_ID.FAJR]).getTime();
  return dayRunSchedule(days, new Date(fajr - 1));
};

/** How long Reduce Motion holds each phase start; null for a run that moves. */
const holdMsFor = (kind: DayRunKind, reduced: boolean): number | null => {
  const config = DAY_RUN[kind];
  return reduced && config.pace === DAY_RUN_PACE.EQUAL_PHASES ? config.phaseMs : null;
};

/** A playing run one step on, ENDED past its end; any other run as it is. */
const stepped = (run: Run | null, kind: DayRunKind, holdMs: number | null): Run | null => {
  if (run?.status !== DAY_RUN_STATUS.PLAYING) return run;
  const { schedule, elapsedMs } = run;
  const toMs =
    holdMs === null
      ? elapsedMs + DAY_RUN[kind].tickMs
      : schedule.phases
          .map((phase) => dayRunPhaseStartMs(schedule, kind, phase))
          .find((start) => start > elapsedMs);
  return toMs === undefined || toMs > dayRunLengthMs(schedule, kind)
    ? { ...run, status: DAY_RUN_STATUS.ENDED }
    : { ...run, elapsedMs: toMs };
};

/** How far a run is from its first phase's start to its end, 0 to 1. */
const progressOf = (run: Run | null, kind: DayRunKind): number => {
  if (!run) return 0;
  if (run.status === DAY_RUN_STATUS.ENDED) return 1;
  const { schedule, elapsedMs } = run;
  const from = dayRunPhaseStartMs(schedule, kind, schedule.phases[0]);
  const span = dayRunLengthMs(schedule, kind) - from;
  return span > 0 ? Math.min(1, Math.max(0, (elapsedMs - from) / span)) : 0;
};

/** Moves a run in status `from` to `to`; any other run as it is. */
const moved =
  (from: RunStatus, to: RunStatus) =>
  (run: Run | null): Run | null =>
    run?.status === from ? { ...run, status: to } : run;

/** Plays a day through for everything inside: a debug run or a preview. */
export const DaySimulator = ({ children, kind }: { children: ReactNode; kind: DayRunKind }) => {
  const yesterday = usePrayerTimesStore((state) => state.yesterdayTimings);
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrow = usePrayerTimesStore((state) => state.tomorrowTimings);
  const own = useTodayStored();
  const pinned = useClockOverride();
  const mode = useAppStore((state) => state.mode);
  const scheme = useAppScheme();
  const parentPhase = usePhase();
  const parentDays = use(SampleDaysContext);
  const holdMs = holdMsFor(kind, useReducedMotion());
  const [run, setRun] = useState<Run | null>(null);
  // What started the run, and what a close gives reader focus to once it ends.
  const starter = useRef<HostInstance | null>(null);
  const focusOnEnd = useRef<HostInstance | null>(null);

  const storeDays = { yesterday, today, tomorrow };
  // A preview plays a sample day until the user's own times are stored.
  const sample = kind === DAY_RUN_KIND.PREVIEW && !own;
  // A sample day is always whole; stored days can end before the day does.
  const available = sample || runSchedule(storeDays) !== null;

  useEffect(() => {
    if (run?.status !== DAY_RUN_STATUS.PLAYING) return;
    const timer = setTimeout(
      () => setRun((current) => stepped(current, kind, holdMs)),
      holdMs ?? DAY_RUN[kind].tickMs
    );
    return () => clearTimeout(timer);
  }, [run, kind, holdMs]);

  const idle = run === null;
  useEffect(() => {
    if (!idle) return;
    focusOn(focusOnEnd.current);
    focusOnEnd.current = null;
  }, [idle]);

  const playing = run?.status === DAY_RUN_STATUS.PLAYING;
  // Leaving the app pauses a run, so it waits where it was for the user.
  useEffect(() => {
    if (!playing) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== APP_STATE.ACTIVE) setRun(moved(DAY_RUN_STATUS.PLAYING, DAY_RUN_STATUS.PAUSED));
    });
    return () => subscription.remove();
  }, [playing]);

  const drawing =
    run?.status === DAY_RUN_STATUS.PLAYING || run?.status === DAY_RUN_STATUS.PAUSED ? run : null;
  const clock = drawing && dayRunClockAt(drawing.schedule, kind, drawing.elapsedMs);
  // Before a first stored Fajr the margin has no phase; it is the night before.
  const runPhase = drawing && clock ? (phaseAt(clock, drawing.days) ?? PHASE.NIGHT) : undefined;
  const phase = runPhase ?? parentPhase;
  const drawnMode = drawing && kind === DAY_RUN_KIND.PREVIEW ? AppMode.ADAPTIVE : null;

  const begin = () => {
    // The day is read at the press, so no clock re-renders the run at rest.
    const days = sample ? sampleDays(pinned ?? new Date()) : storeDays;
    const schedule = runSchedule(days);
    if (!schedule) return;
    const first = holdMs === null ? 0 : dayRunPhaseStartMs(schedule, kind, schedule.phases[0]);
    setRun({ days, schedule, status: DAY_RUN_STATUS.PLAYING, elapsedMs: first });
  };

  const dayRun: DayRun = {
    kind,
    status: run?.status ?? DAY_RUN_STATUS.IDLE,
    phase: runPhase,
    progress: progressOf(run, kind),
    available,
    start: (from) => {
      starter.current = from ?? null;
      begin();
    },
    replay: begin,
    pause: () => setRun(moved(DAY_RUN_STATUS.PLAYING, DAY_RUN_STATUS.PAUSED)),
    resume: () => setRun(moved(DAY_RUN_STATUS.PAUSED, DAY_RUN_STATUS.PLAYING)),
    jumpTo: (to) =>
      setRun(
        (current) =>
          current && {
            ...current,
            status: DAY_RUN_STATUS.PAUSED,
            elapsedMs: dayRunPhaseStartMs(current.schedule, kind, to),
          }
      ),
    done: () => setRun(null),
    close: () => {
      focusOnEnd.current = starter.current;
      setRun(null);
    },
  };

  // Every provider renders at rest too, so nothing inside remounts with a run.
  return (
    <DayRunContext value={dayRun}>
      <SimulatedClockContext value={clock}>
        <PhaseContext value={phase}>
          <DrawnModeContext value={drawnMode}>
            <SampleDaysContext value={drawing ? drawing.days : parentDays}>
              <BrightnessTheme dark={isDarkMode(drawnMode ?? mode, scheme, phase)}>
                {children}
              </BrightnessTheme>
            </SampleDaysContext>
          </DrawnModeContext>
        </PhaseContext>
      </SimulatedClockContext>
    </DayRunContext>
  );
};

/** The button that starts a run, shown only in debug mode. */
export const DaySimulatorButton = () => {
  const debug = useDebugModeStore((state) => state.isEnabled);
  const run = useDayRun();
  if (!debug || !run) return null;

  return (
    <Button
      onPress={() => run.start()}
      disabled={!run.available || run.status === DAY_RUN_STATUS.PLAYING}
      accessibilityRole="button"
      accessibilityLabel={DAY_RUN_DEBUG_LABEL}>
      <Button.Text>{DAY_RUN_DEBUG_LABEL}</Button.Text>
    </Button>
  );
};
