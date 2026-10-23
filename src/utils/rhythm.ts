import { parseISO } from "date-fns";

import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { TICK_STATE, type TickState } from "@/constants/Timeline";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { inFocusWindow } from "@/utils/focusCount";
import { ONE_DAY_MS } from "@/utils/phase";

export type RhythmTimingId = PrayerId | typeof OTHER_TIMING.SUNRISE;

/** The night's own marks, between Isha and the next Fajr. */
const NIGHT_TIMINGS = [OTHER_TIMING.MIDNIGHT, OTHER_TIMING.LAST_THIRD] as const;
export type NightTimingId = (typeof NIGHT_TIMINGS)[number];

/** The timings the day marks, in the day's order. */
const RHYTHM_TIMINGS: readonly RhythmTimingId[] = [
  PRAYER_ID.FAJR,
  OTHER_TIMING.SUNRISE,
  PRAYER_ID.DHUHR,
  PRAYER_ID.ASR,
  PRAYER_ID.MAGHRIB,
  PRAYER_ID.ISHA,
];

export type RhythmMark<Id extends string = RhythmTimingId> = {
  id: Id;
  share: number;
  state: TickState;
};

export type RhythmLine = {
  /** Each timing's place by the clock, from 0 at Fajr to 1 at Isha. */
  marks: RhythmMark[];
  /** Now on the same scale; after Isha it walks back from 1 to 0 at Fajr. */
  now: number;
  /** After Isha, the night's marks on the walk back; else null. */
  night: RhythmMark<NightTimingId>[] | null;
  /** The prayer just come in, else the next; past Isha, tomorrow's Fajr. */
  focus: PrayerId | null;
};

const timeOf = (day: DayPrayerTimes, id: RhythmTimingId) =>
  parseISO(
    id === OTHER_TIMING.SUNRISE ? day.otherTimings[OTHER_TIMING.SUNRISE] : day.timings[id]
  ).getTime();

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/** Each time's state against `clock`: the latest one in is current. */
const statesAt = (times: number[], clock: number): TickState[] => {
  const current = times.findLastIndex((time) => time <= clock);
  return times.map((_, i) => {
    if (i === current) return TICK_STATE.CURRENT;
    return i < current ? TICK_STATE.PASSED : TICK_STATE.FUTURE;
  });
};

/** The prayer day as one arc: the day by the clock, the night walked back. */
export const rhythmLine = (
  day: DayPrayerTimes,
  now: Date,
  /** The day after, whose Fajr ends the night. */
  following?: DayPrayerTimes | null
): RhythmLine => {
  const times = RHYTHM_TIMINGS.map((id) => timeOf(day, id));
  const [fajr, isha] = [times[0], times[times.length - 1]];
  const clock = now.getTime();
  const states = statesAt(times, clock);

  const marks = RHYTHM_TIMINGS.map((id, i): RhythmMark => ({
    id,
    share: (times[i] - fajr) / (isha - fajr),
    state: states[i],
  }));

  const nextFajr = following
    ? parseISO(following.timings[PRAYER_ID.FAJR]).getTime()
    : fajr + ONE_DAY_MS;
  const walkedBack = (time: number) => 1 - clamp01((time - isha) / (nextFajr - isha));
  const inNight = (time: number) => time > isha && time < nextFajr;

  const night = (() => {
    if (clock < isha) return null;
    // A provider may date the night's times by either day.
    const found = NIGHT_TIMINGS.flatMap((id) => {
      const time = [day, following]
        .map((each) => (each?.otherTimings[id] ? parseISO(each.otherTimings[id]).getTime() : NaN))
        .find(inNight);
      return time === undefined ? [] : [{ id, time }];
    });
    const nightStates = statesAt(
      found.map(({ time }) => time),
      clock
    );
    return found.map(({ id, time }, i): RhythmMark<NightTimingId> => ({
      id,
      share: walkedBack(time),
      state: nightStates[i],
    }));
  })();

  const isPrayer = (id: RhythmTimingId): id is PrayerId => id !== OTHER_TIMING.SUNRISE;
  const nextPrayer = RHYTHM_TIMINGS.find(
    (id, i): id is PrayerId => isPrayer(id) && times[i] > clock
  );
  const latest = RHYTHM_TIMINGS.findLast(
    (id, i): id is PrayerId => isPrayer(id) && times[i] <= clock
  );
  const latestTime = latest ? times[RHYTHM_TIMINGS.indexOf(latest)] : undefined;
  const inFocus =
    latest && latestTime !== undefined && inFocusWindow(latestTime, clock) ? latest : undefined;

  const afterIsha = following ? PRAYER_ID.FAJR : null;
  return {
    marks,
    now: night ? walkedBack(clock) : clamp01((clock - fajr) / (isha - fajr)),
    night,
    focus: inFocus ?? nextPrayer ?? afterIsha,
  };
};
