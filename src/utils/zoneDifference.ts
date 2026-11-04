import type { ParseKeys } from "i18next";

import {
  ZONE_COPY_KEY,
  ZONE_DIRECTION,
  ZONE_NOTE_KEY,
  ZONE_UNIT,
  type ZoneDirection,
  type ZoneUnit,
} from "@/constants/CityOffer";

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HALF_HOUR_MINUTES = MINUTES_PER_HOUR / 2;

const HOURS_PER_DAY = 24;

// Read from the zone's own clock: date-fns-tz takes the instant as wall-clock
// time, which gives the wrong side of a daylight-saving change near it.
const zoneFormatOf = (zone: string): Intl.DateTimeFormat | null => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  } catch {
    return null;
  }
};

/** Minutes a zone runs ahead of UTC at `at`; null for an unknown zone. */
export const zoneOffsetMinutes = (zone: string, at: number): number | null => {
  const format = zoneFormatOf(zone);
  if (!format) return null;
  const parts = format.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  const wall = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour") % HOURS_PER_DAY,
    part("minute")
  );
  return (wall - Math.floor(at / MINUTE_MS) * MINUTE_MS) / MINUTE_MS;
};

/** Minutes `to` runs ahead of `from` at `at`; negative when behind. */
export const zoneDifferenceMinutes = (from: string, to: string, at: number): number | null => {
  const fromOffset = zoneOffsetMinutes(from, at);
  const toOffset = zoneOffsetMinutes(to, at);
  return fromOffset === null || toOffset === null ? null : toOffset - fromOffset;
};

type ZoneKeys = Record<ZoneDirection, Record<ZoneUnit, ParseKeys>>;

/** The key for `minutes` read in `direction`, with its count; the unit rule. */
const copyIn = (
  keys: ZoneKeys,
  direction: ZoneDirection,
  minutes: number
): { key: ParseKeys; count: number } => {
  const apart = Math.abs(minutes);
  const wholeHours = Math.floor(apart / MINUTES_PER_HOUR);
  const rest = apart % MINUTES_PER_HOUR;
  if (rest === 0) return { key: keys[direction][ZONE_UNIT.HOURS], count: wholeHours };
  if (rest === HALF_HOUR_MINUTES)
    return { key: keys[direction][ZONE_UNIT.HALF_HOURS], count: wholeHours };
  return { key: keys[direction][ZONE_UNIT.MINUTES], count: apart };
};

/** The copy key and count for a difference; null when the clocks agree. */
export const zoneCopyOf = (minutes: number): { key: ParseKeys; count: number } | null => {
  if (minutes === 0) return null;
  const direction = minutes > 0 ? ZONE_DIRECTION.AHEAD : ZONE_DIRECTION.BEHIND;
  return copyIn(ZONE_COPY_KEY, direction, minutes);
};

/**
 * The same difference said from the other clock's side: when `minutes` is
 * positive the saved place is the one behind. Null when the clocks agree.
 */
export const zoneNoteOf = (minutes: number): { key: ParseKeys; count: number } | null => {
  if (minutes === 0) return null;
  const direction = minutes > 0 ? ZONE_DIRECTION.BEHIND : ZONE_DIRECTION.AHEAD;
  return copyIn(ZONE_NOTE_KEY, direction, minutes);
};
