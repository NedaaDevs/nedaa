import { parseISO } from "date-fns";

import { COUNT_AXIS, PRAYER_FOCUS, type CountAxis } from "@/constants/Countdown";
import { PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import { storedDayList, type StoredDays } from "@/utils/phase";

/** A prayer at its moment, with the timezone of the day it belongs to. */
export type FocusPrayer = { id: PrayerId; time: Date; timezone: string };

export type CountSettings = {
  /** «Show seconds»: the figure counts to the second, both ways. */
  seconds: boolean;
};

export type FocusCount = {
  axis: CountAxis;
  /** The prayer the block names: the one just come in, else the next. */
  named: FocusPrayer;
  /** Whether the named prayer is the one in its focus window now. */
  current: boolean;
  /** The prayer the figure counts to or from. */
  counted: FocusPrayer;
  seconds: number;
  /** Whether the figure shows seconds. */
  precise: boolean;
};

/** Whether a time that came in at `startedAt` is still in its focus window. */
export const inFocusWindow = (startedAt: number, now: number) =>
  now >= startedAt && now - startedAt < PRAYER_FOCUS.activeMs;

const prayersIn = (days: StoredDays): FocusPrayer[] =>
  storedDayList(days).flatMap((day) =>
    PRAYER_IDS.map((id) => ({ id, time: parseISO(day.timings[id]), timezone: day.timezone }))
  );

/** What the focus block counts at `now`; null with no later prayer stored. */
export const focusCount = (
  now: Date,
  days: StoredDays,
  settings: CountSettings,
  flipped: boolean
): FocusCount | null => {
  const prayers = prayersIn(days);
  const next = prayers.find((prayer) => prayer.time > now);
  if (!next) return null;
  const previous = prayers.findLast((prayer) => prayer.time <= now);

  const secondsTo = (prayer: FocusPrayer) =>
    Math.abs(Math.round((prayer.time.getTime() - now.getTime()) / 1000));
  const precise = settings.seconds;
  const inFocus = previous !== undefined && inFocusWindow(previous.time.getTime(), now.getTime());

  // A prayer just come in is named and counted up from; flipped, the next one.
  if (inFocus && !flipped) {
    return {
      axis: COUNT_AXIS.SINCE,
      named: previous,
      current: true,
      counted: previous,
      seconds: secondsTo(previous),
      precise,
    };
  }
  // Between prayers the next is named; flipped, the figure counts from the last.
  if (!inFocus && flipped && previous) {
    return {
      axis: COUNT_AXIS.SINCE,
      named: next,
      current: false,
      counted: previous,
      seconds: secondsTo(previous),
      precise,
    };
  }
  return {
    axis: COUNT_AXIS.UNTIL,
    named: next,
    current: false,
    counted: next,
    seconds: secondsTo(next),
    precise,
  };
};

const pad = (n: number) => String(n).padStart(2, "0");

/** h:mm, or h:mm:ss with seconds (m:ss under an hour); minutes round to now. */
export const formatCount = (seconds: number, precise: boolean, axis: CountAxis): string => {
  if (precise) {
    const [hours, minutes] = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60];
    const tail = `${pad(minutes)}:${pad(seconds % 60)}`;
    return hours ? `${hours}:${tail}` : `${minutes}:${pad(seconds % 60)}`;
  }
  const minutes = axis === COUNT_AXIS.UNTIL ? Math.ceil(seconds / 60) : Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
};
