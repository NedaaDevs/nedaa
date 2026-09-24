import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { BRIGHTNESS, type Brightness } from "@/constants/Palette";
import { PHASE, type Phase } from "@/constants/Phase";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";

/** Maghrib and night draw dark; the daylight phases draw light. */
export const PHASE_BRIGHTNESS: Record<Phase, Brightness> = {
  [PHASE.DAWN]: BRIGHTNESS.LIGHT,
  [PHASE.DAY]: BRIGHTNESS.LIGHT,
  [PHASE.ASR]: BRIGHTNESS.LIGHT,
  [PHASE.MAGHRIB]: BRIGHTNESS.DARK,
  [PHASE.NIGHT]: BRIGHTNESS.DARK,
};

/** Each phase and the calculated time it begins, in the day's order. */
const phaseStarts = (day: DayPrayerTimes): [Phase, Date][] => [
  [PHASE.DAWN, parseISO(day.timings[PRAYER_ID.FAJR])],
  [PHASE.DAY, parseISO(day.otherTimings[OTHER_TIMING.SUNRISE])],
  [PHASE.ASR, parseISO(day.timings[PRAYER_ID.ASR])],
  [PHASE.MAGHRIB, parseISO(day.timings[PRAYER_ID.MAGHRIB])],
  [PHASE.NIGHT, parseISO(day.timings[PRAYER_ID.ISHA])],
];

/** The days the store holds around today; any of them may be missing. */
export type StoredDays = {
  yesterday?: DayPrayerTimes | null;
  today?: DayPrayerTimes | null;
  tomorrow?: DayPrayerTimes | null;
};

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** The stored days that are present, in time order. */
export const storedDayList = (days: StoredDays): DayPrayerTimes[] =>
  [days.yesterday, days.today, days.tomorrow].filter((day): day is DayPrayerTimes => day != null);

/** The stored day whose date `now` falls on, in that day's timezone. */
export const storedDayOn = (now: Date, days: StoredDays): DayPrayerTimes | undefined =>
  storedDayList(days).find(
    (day) => Number(formatInTimeZone(now, day.timezone, "yyyyMMdd")) === day.date
  );

/**
 * Every stored boundary in time order, and the span the stored days cover: from the
 * first stored Fajr to a day after the last, because the final night ends at a Fajr
 * the store does not hold.
 */
const timeline = (days: StoredDays) => {
  const stored = storedDayList(days);
  if (stored.length === 0) return undefined;
  const boundaries = stored.flatMap(phaseStarts);
  const lastFajr = phaseStarts(stored[stored.length - 1])[0][1].getTime();
  return { boundaries, from: boundaries[0][1], until: new Date(lastFajr + ONE_DAY_MS) };
};

/**
 * The phase at `now`, read across every stored day: the store rolls its days only
 * on launch or foreground, so "today" can already be yesterday. Undefined outside
 * the stored days.
 */
export const phaseAt = (now: Date, days: StoredDays): Phase | undefined => {
  const line = timeline(days);
  if (!line || now < line.from || now >= line.until) return undefined;
  return line.boundaries.reduce<Phase>(
    (current, [phase, start]) => (now >= start ? phase : current),
    PHASE.NIGHT
  );
};

/** The next moment the phase can change, always after `now`. */
export const nextPhaseStart = (now: Date, days: StoredDays): Date | undefined => {
  const line = timeline(days);
  if (!line) return undefined;
  const next = line.boundaries.find(([, start]) => start > now)?.[1];
  if (next) return next;
  return line.until > now ? line.until : undefined;
};
