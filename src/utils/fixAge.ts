import { FIX_AGE_UNIT, type FixAgeUnit } from "@/constants/Location";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type FixAge = { unit: FixAgeUnit; count: number };

/** How long ago a fix was observed, in the largest whole unit. */
export const fixAgeOf = (fixedAt: number, now: number): FixAge => {
  // A fix stamped ahead of the clock reads as just now.
  const age = Math.max(0, now - fixedAt);
  if (age < MINUTE_MS) return { unit: FIX_AGE_UNIT.NOW, count: 0 };
  if (age < HOUR_MS) return { unit: FIX_AGE_UNIT.MINUTES, count: Math.floor(age / MINUTE_MS) };
  if (age < DAY_MS) return { unit: FIX_AGE_UNIT.HOURS, count: Math.floor(age / HOUR_MS) };
  return { unit: FIX_AGE_UNIT.DAYS, count: Math.floor(age / DAY_MS) };
};
