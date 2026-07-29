import { compareAsc, parseISO } from "date-fns";

/**
 * Picking the current/next timing from a day's entries.
 *
 * Prayer times are stored as ISO 8601 strings carrying the location's UTC offset,
 * so `parseISO` yields an absolute instant. Comparing those against a plain
 * `new Date()` — also an absolute instant — keeps the answer independent of the
 * device's timezone.
 *
 * Do NOT compare against `timeZonedNow()`. That returns a Date whose *local*
 * fields have been shifted to read as the target zone's wall clock, which is
 * right for formatting and for deciding which calendar day to load, but is the
 * wrong instant by (location offset − device offset). Comparing it against a
 * real instant makes prayers appear passed early for anyone whose device clock
 * isn't set to the location's zone.
 */

type TimingLike = { time: string };

const sortByInstant = <T extends TimingLike>(entries: T[]): T[] =>
  [...entries].sort((a, b) => compareAsc(parseISO(a.time), parseISO(b.time)));

/** The earliest entry strictly after `now`, or null if they have all passed. */
export const firstAfter = <T extends TimingLike>(entries: T[], now: Date): T | null =>
  sortByInstant(entries).find((entry) => compareAsc(now, parseISO(entry.time)) === -1) ?? null;

/** The latest entry strictly before `now`, or null if none has passed yet. */
export const lastBefore = <T extends TimingLike>(entries: T[], now: Date): T | null => {
  const sorted = sortByInstant(entries);
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (compareAsc(parseISO(sorted[i].time), now) === -1) return sorted[i];
  }
  return null;
};

/**
 * Earliest / latest entry regardless of `now`.
 *
 * These back the adjacent-day fallbacks. They must not be time-filtered: when
 * cached data lags behind the clock, every entry can sit in the past, and
 * returning null there leaves the home screen with nothing to render at all.
 */
export const earliest = <T extends TimingLike>(entries: T[]): T | null =>
  sortByInstant(entries)[0] ?? null;

export const latest = <T extends TimingLike>(entries: T[]): T | null =>
  sortByInstant(entries).at(-1) ?? null;
