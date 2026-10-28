import { DAY_RUN, DAY_RUN_MARGIN_MS, DAY_RUN_PACE, type DayRunKind } from "@/constants/DayRun";
import { PHASE, type Phase } from "@/constants/Phase";
import { nextPhaseStart, phaseAt, type StoredDays } from "@/utils/phase";

/** The clock times a day run covers, and the phases between them. */
export type DayRunSchedule = {
  /** The margin start, then Fajr, Sunrise, Asr, Maghrib, Isha and next Fajr. */
  boundaries: Date[];
  /** The phase that begins at each boundary after the margin start. */
  phases: Phase[];
};

/** The first Fajr after `after`; the end of the stored span is one too. */
const fajrAfter = (after: Date, days: StoredDays): Date | undefined => {
  for (let at = nextPhaseStart(after, days); at; at = nextPhaseStart(at, days)) {
    // phaseAt is undefined only at the span's end, where the last night ends.
    if ((phaseAt(at, days) ?? PHASE.DAWN) === PHASE.DAWN) return at;
  }
  return undefined;
};

/** The margin before the next Fajr to the Fajr after; null if not stored. */
export const dayRunSchedule = (days: StoredDays, near: Date): DayRunSchedule | null => {
  const fajr = fajrAfter(near, days);
  if (!fajr) return null;

  const phases = Object.values(PHASE);
  const boundaries = [new Date(fajr.getTime() - DAY_RUN_MARGIN_MS), fajr];
  for (let end = fajr, count = 0; count < phases.length; count++) {
    const next = nextPhaseStart(end, days);
    if (!next) return null;
    boundaries.push(next);
    end = next;
  }
  return { boundaries, phases };
};

/** A stretch of a run: the elapsed time it takes, the clock time it covers. */
type Leg = { fromMs: number; toMs: number; clockFrom: number; clockTo: number };

/** The elapsed time a leg takes; leg 0 is the margin before Fajr. */
const legDurationMs = (kind: DayRunKind, index: number, clockMs: number): number => {
  const config = DAY_RUN[kind];
  if (config.pace === DAY_RUN_PACE.LINEAR) return (clockMs * config.tickMs) / config.stepMs;
  return index === 0 ? config.preludeMs : config.phaseMs;
};

/** The margin, then one leg for each phase. */
const legs = (schedule: DayRunSchedule, kind: DayRunKind): Leg[] => {
  let elapsed = 0;
  return schedule.boundaries.slice(1).map((end, index) => {
    const clockFrom = schedule.boundaries[index].getTime();
    const clockTo = end.getTime();
    const fromMs = elapsed;
    elapsed += legDurationMs(kind, index, clockTo - clockFrom);
    return { fromMs, toMs: elapsed, clockFrom, clockTo };
  });
};

/** How long a run takes, in elapsed milliseconds. */
export const dayRunLengthMs = (schedule: DayRunSchedule, kind: DayRunKind): number => {
  const all = legs(schedule, kind);
  return all[all.length - 1].toMs;
};

/** The clock `elapsedMs` into a run; holds at the first and last boundary. */
export const dayRunClockAt = (
  schedule: DayRunSchedule,
  kind: DayRunKind,
  elapsedMs: number
): Date => {
  const all = legs(schedule, kind);
  const elapsed = Math.min(Math.max(elapsedMs, 0), all[all.length - 1].toMs);
  const leg = all.findLast((candidate) => candidate.fromMs <= elapsed) ?? all[0];
  const span = leg.toMs - leg.fromMs;
  const progress = span > 0 ? (elapsed - leg.fromMs) / span : 1;
  return new Date(Math.round(leg.clockFrom + progress * (leg.clockTo - leg.clockFrom)));
};

/** The elapsed time at which a run reaches the start of `phase`. */
export const dayRunPhaseStartMs = (
  schedule: DayRunSchedule,
  kind: DayRunKind,
  phase: Phase
): number => legs(schedule, kind)[schedule.phases.indexOf(phase) + 1].fromMs;
