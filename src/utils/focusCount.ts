import { parseISO } from "date-fns";

import { COUNT_AXIS, type CountAxis } from "@/constants/Countdown";
import { PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import { storedDayList, type StoredDays } from "@/utils/phase";

/** A prayer at its moment, with the timezone of the day it belongs to. */
export type FocusPrayer = { id: PrayerId; time: Date; timezone: string };

export type CountSettings = {
  /** «Show seconds»: the figure counts to the second, both ways. */
  seconds: boolean;
  /** «Iqama Timer»: the minutes after an athan, opened on the time since it. */
  iqama: { enabled: boolean; minutes: number };
};

export type FocusCount = {
  axis: CountAxis;
  /** The prayer the block names: always the next one. */
  next: FocusPrayer;
  /** The prayer the figure counts to or from. */
  counted: FocusPrayer;
  seconds: number;
  /** Whether the figure shows seconds. */
  precise: boolean;
};

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
  const { iqama, seconds: precise } = settings;
  const inIqama =
    previous !== undefined && iqama.enabled && secondsTo(previous) <= iqama.minutes * 60;

  if (inIqama !== flipped && previous) {
    return {
      axis: COUNT_AXIS.SINCE,
      next,
      counted: previous,
      seconds: secondsTo(previous),
      precise,
    };
  }
  return { axis: COUNT_AXIS.UNTIL, next, counted: next, seconds: secondsTo(next), precise };
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
