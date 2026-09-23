import { HijriNative } from "@/utils/date";

/** Days from one new moon to the next. */
const SYNODIC_MONTH_DAYS = 29.53;

/** How far through its cycle the moon is on a Hijri day: 0 new, 0.5 full. */
export const moonPhaseFor = (hijriDay: number) => (hijriDay / SYNODIC_MONTH_DAYS) % 1;

/** The Hijri day at `now` in the times' timezone, with the user's offset. */
export const hijriDayAt = (now: Date, timezone: string, offset: number) => {
  try {
    // hijri-native reads Unix seconds.
    const date = HijriNative.fromTimestamp(Math.floor(now.getTime() / 1000), timezone);
    return (offset === 0 ? date : HijriNative.addDays(date, offset)).day;
  } catch {
    return undefined;
  }
};

/** The share of the disc lit, from 0 at new moon to 1 at full. */
export const litFraction = (phase: number) => (1 - Math.cos(2 * Math.PI * phase)) / 2;

/** Whether the lit limb is on the right: it faces the sun's side of the sky. */
export const litsRight = (phase: number, isRTL: boolean) => phase < 0.5 !== isRTL;

/**
 * The moon's lit part as an SVG path: a half disc on the lit side, closed by an
 * elliptical terminator. The lit side faces the sun, which sets at the reading
 * end while the moon waxes and rises at the reading start while it wanes.
 */
export const moonPath = (cx: number, cy: number, r: number, phase: number, isRTL: boolean) => {
  const litRight = litsRight(phase, isRTL);
  const bulge = Math.cos(2 * Math.PI * phase);
  const crescent = bulge > 0;
  const limbSweep = litRight ? 1 : 0;
  const terminatorSweep = crescent ? 1 - limbSweep : limbSweep;
  const round = (n: number) => Number(n.toFixed(2));
  const top = `${round(cx)} ${round(cy - r)}`;
  const bottom = `${round(cx)} ${round(cy + r)}`;
  return (
    `M ${top} A ${r} ${r} 0 0 ${limbSweep} ${bottom} ` +
    `A ${round(Math.abs(bulge) * r)} ${r} 0 0 ${terminatorSweep} ${top} Z`
  );
};

/**
 * Degrees to turn the moon so its lit limb points at the sun below the horizon:
 * where it set while waxing, where it rises while waning; none at full.
 */
export const moonTilt = (phase: number, isRTL: boolean, maxDegrees: number) => {
  const towardEnd = phase < 0.5;
  const sign = towardEnd === isRTL ? -1 : 1;
  return sign * maxDegrees * (1 - litFraction(phase));
};
