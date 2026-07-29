import { compareAsc, parseISO } from "date-fns";

// Stored times carry the location's UTC offset, so compare against a real
// `new Date()`. `timeZonedNow()` is shifted and would skew these by the device zone.

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

// Adjacent-day fallbacks. Not time-filtered: stale cached data can put every
// entry in the past, and null there leaves the home screen with nothing to render.
export const earliest = <T extends TimingLike>(entries: T[]): T | null =>
  sortByInstant(entries)[0] ?? null;

export const latest = <T extends TimingLike>(entries: T[]): T | null =>
  sortByInstant(entries).at(-1) ?? null;
