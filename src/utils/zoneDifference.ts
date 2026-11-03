import type { ParseKeys } from "i18next";
import { getTimezoneOffset } from "date-fns-tz";

import { ZONE_COPY_KEY, ZONE_DIRECTION, ZONE_UNIT } from "@/constants/CityOffer";

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HALF_HOUR_MINUTES = MINUTES_PER_HOUR / 2;

/** Minutes a zone runs ahead of UTC at `at`; null for an unknown zone. */
export const zoneOffsetMinutes = (zone: string, at: number): number | null => {
  const offsetMs = getTimezoneOffset(zone, at);
  return Number.isNaN(offsetMs) ? null : offsetMs / MINUTE_MS;
};

/** Minutes `to` runs ahead of `from` at `at`; negative when behind. */
export const zoneDifferenceMinutes = (from: string, to: string, at: number): number | null => {
  const fromOffset = zoneOffsetMinutes(from, at);
  const toOffset = zoneOffsetMinutes(to, at);
  return fromOffset === null || toOffset === null ? null : toOffset - fromOffset;
};

/** The copy key and count for a difference; null when the clocks agree. */
export const zoneCopyOf = (minutes: number): { key: ParseKeys; count: number } | null => {
  if (minutes === 0) return null;
  const direction = minutes > 0 ? ZONE_DIRECTION.AHEAD : ZONE_DIRECTION.BEHIND;
  const apart = Math.abs(minutes);
  const wholeHours = Math.floor(apart / MINUTES_PER_HOUR);
  const rest = apart % MINUTES_PER_HOUR;
  if (rest === 0) return { key: ZONE_COPY_KEY[direction][ZONE_UNIT.HOURS], count: wholeHours };
  if (rest === HALF_HOUR_MINUTES)
    return { key: ZONE_COPY_KEY[direction][ZONE_UNIT.HALF_HOURS], count: wholeHours };
  return { key: ZONE_COPY_KEY[direction][ZONE_UNIT.MINUTES], count: apart };
};
