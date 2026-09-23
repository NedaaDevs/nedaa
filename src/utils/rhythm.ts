import { parseISO } from "date-fns";

import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { TICK_STATE, type TickState } from "@/constants/Timeline";
import type { DayPrayerTimes } from "@/types/prayerTimes";

export type RhythmTimingId = PrayerId | typeof OTHER_TIMING.SUNRISE;

/** The timings the line marks, in the day's order. */
export const RHYTHM_TIMINGS: readonly RhythmTimingId[] = [
  PRAYER_ID.FAJR,
  OTHER_TIMING.SUNRISE,
  PRAYER_ID.DHUHR,
  PRAYER_ID.ASR,
  PRAYER_ID.MAGHRIB,
  PRAYER_ID.ISHA,
];

/** How much of its time the stretch from sunrise to Dhuhr takes on the line. */
export const MORNING_WEIGHT = 0.5;

export type RhythmMark = { id: RhythmTimingId; share: number; state: TickState };

export type RhythmLine = {
  /** Each timing's place on the line, from 0 at Fajr to 1 at Isha. */
  marks: RhythmMark[];
  /** The stretch from the current timing to the next, and the part gone. */
  progress: { from: number; to: number; fraction: number } | null;
};

const timeOf = (day: DayPrayerTimes, id: RhythmTimingId) =>
  parseISO(
    id === OTHER_TIMING.SUNRISE ? day.otherTimings[OTHER_TIMING.SUNRISE] : day.timings[id]
  ).getTime();

/** The prayer day as a straight line: each timing placed by its time. */
export const rhythmLine = (day: DayPrayerTimes, now: Date): RhythmLine => {
  const times = RHYTHM_TIMINGS.map((id) => timeOf(day, id));
  // Each timing's distance from Fajr, the prayer-free morning counted short.
  const drawn = times.map(() => 0);
  for (let i = 1; i < times.length; i++) {
    const weight = RHYTHM_TIMINGS[i] === PRAYER_ID.DHUHR ? MORNING_WEIGHT : 1;
    drawn[i] = drawn[i - 1] + (times[i] - times[i - 1]) * weight;
  }
  const shareOf = (i: number) => drawn[i] / drawn[drawn.length - 1];

  const clock = now.getTime();
  const current = times.findLastIndex((time) => time <= clock);
  const stateOf = (i: number): TickState => {
    if (i === current) return TICK_STATE.CURRENT;
    return i < current ? TICK_STATE.PASSED : TICK_STATE.FUTURE;
  };

  const marks = RHYTHM_TIMINGS.map((id, i): RhythmMark => ({
    id,
    share: shareOf(i),
    state: stateOf(i),
  }));

  const next = current + 1;
  const progress =
    current >= 0 && next < times.length
      ? {
          from: marks[current].share,
          to: marks[next].share,
          fraction: (clock - times[current]) / (times[next] - times[current]),
        }
      : null;

  return { marks, progress };
};
