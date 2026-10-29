import { toZonedTime } from "date-fns-tz";

import { SHIFT_HORIZON_DAYS, SHIFT_TIMING, type ShiftTiming } from "@/constants/CityCheck";
import { METHOD_ANGLES } from "@/constants/aladhanMethods";
import type { ShiftCalc } from "@/types/cityCheck";
import type { Coords } from "@/types/location";

// PrayTimes.org's sun model, as AlAdhan's prayer-times library ports it.

const RAD = Math.PI / 180;
const HOURS_PER_DAY = 24;
const DEGREES_PER_HOUR = 15;
const MINUTES_PER_HOUR = 60;
const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR;
const J2000 = 2451545.0;
/** Sun's upper limb at the horizon, with refraction, at sea level. */
const RISE_SET_DEGREES = 0.833;
/** Angle-based high-latitude rule: at most angle / 60 of the night. */
const NIGHT_PORTION_PER_DEGREE = 1 / 60;
/** First guesses, in local solar hours, of one pass of the model. */
const GUESS_HOURS = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18 } as const;

const sin = (deg: number) => Math.sin(deg * RAD);
const cos = (deg: number) => Math.cos(deg * RAD);
const tan = (deg: number) => Math.tan(deg * RAD);
const asin = (x: number) => Math.asin(x) / RAD;
const acos = (x: number) => Math.acos(x) / RAD;
const atan2 = (y: number, x: number) => Math.atan2(y, x) / RAD;
const acot = (x: number) => Math.atan(1 / x) / RAD;
const wrap = (a: number, b: number) => a - b * Math.floor(a / b);
const wrapHour = (h: number) => wrap(h, HOURS_PER_DAY);

export type CalendarDay = { year: number; month: number; day: number };

const julianDate = ({ year, month, day }: CalendarDay): number => {
  const y = month <= 2 ? year - 1 : year;
  const m = month <= 2 ? month + 12 : month;
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
};

// Ref: aa.usno.navy.mil/faq/docs/SunApprox.php
const sunPosition = (jd: number) => {
  const d = jd - J2000;
  const g = wrap(357.529 + 0.98560028 * d, 360);
  const q = wrap(280.459 + 0.98564736 * d, 360);
  const l = wrap(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * d;
  const ra = atan2(cos(e) * sin(l), cos(l)) / DEGREES_PER_HOUR;
  return { declination: asin(sin(e) * sin(l)), equation: q / DEGREES_PER_HOUR - wrapHour(ra) };
};

// Ported from prayer-times-moonsighting, src/MoonSighting at f8a8ea44.
type Knots = readonly [number, number, number, number];

/** Moonsighting Committee minutes for one day of its year, by four knots. */
const seasonalMinutes = (knots: Knots, dyy: number) => {
  const [a, b, c, d] = knots;
  if (dyy < 91) return a + ((b - a) / 91) * dyy;
  if (dyy < 137) return b + ((c - b) / 46) * (dyy - 91);
  if (dyy < 183) return c + ((d - c) / 46) * (dyy - 137);
  if (dyy < 229) return d + ((c - d) / 46) * (dyy - 183);
  if (dyy < 275) return c + ((b - c) / 46) * (dyy - 229);
  return b + ((a - b) / 91) * (dyy - 275);
};

// Days since the winter solstice of the date's own year, per hemisphere.
const solsticeDay = ({ year, month, day }: CalendarDay, latitude: number) => {
  const zero = latitude > 0 ? Date.UTC(year, 11, 21) : Date.UTC(year, 5, 21);
  const diff = Math.round((Date.UTC(year, month - 1, day) - zero) / MS_PER_DAY);
  return diff > 0 ? diff : 365 + diff;
};

const fajrKnots = (lat: number): Knots => {
  const l = Math.abs(lat) / 55;
  return [75 + 28.65 * l, 75 + 19.44 * l, 75 + 32.74 * l, 75 + 48.1 * l];
};

// The general shafaq.
const ishaKnots = (lat: number): Knots => {
  const l = Math.abs(lat) / 55;
  return [75 + 25.6 * l, 75 + 2.05 * l, 75 - 9.21 * l, 75 + 6.14 * l];
};

/** One calendar day's timings at a place, as UTC instants in ms. */
export const dayTimings = (
  { latitude, longitude }: Coords,
  date: CalendarDay,
  { method: methodId, school }: ShiftCalc
): Record<ShiftTiming, number> => {
  const method = METHOD_ANGLES[methodId];
  // A shadow of school + 1 object lengths starts Asr.
  const shadowLength = school + 1;
  const jd = julianDate(date) - longitude / (DEGREES_PER_HOUR * HOURS_PER_DAY);
  const at = (hour: number) => sunPosition(jd + hour / HOURS_PER_DAY);
  const midDay = (hour: number) => wrapHour(12 - at(hour).equation);
  const sunAngleTime = (angle: number, hour: number, beforeNoon = false) => {
    const { declination } = at(hour);
    const cosRange =
      (-sin(angle) - sin(declination) * sin(latitude)) / (cos(declination) * cos(latitude));
    const t = acos(Math.min(1, Math.max(-1, cosRange))) / DEGREES_PER_HOUR;
    return midDay(hour) + (beforeNoon ? -t : t);
  };
  const asrTime = (hour: number) => {
    const { declination } = at(hour);
    return sunAngleTime(-acot(shadowLength + tan(Math.abs(latitude - declination))), hour);
  };

  const sunrise = sunAngleTime(RISE_SET_DEGREES, GUESS_HOURS.sunrise, true);
  const sunset = sunAngleTime(RISE_SET_DEGREES, GUESS_HOURS.sunset);
  const night = wrapHour(sunrise - sunset);
  const portion = (angle: number) => angle * NIGHT_PORTION_PER_DEGREE * night;
  const beforeSunrise = (angle: number) =>
    Math.min(wrapHour(sunrise - sunAngleTime(angle, GUESS_HOURS.fajr, true)), portion(angle));
  const afterSunset = (angle: number) =>
    Math.min(wrapHour(sunAngleTime(angle, GUESS_HOURS.sunset) - sunset), portion(angle));
  const seasonal = (knots: Knots) =>
    Math.round(seasonalMinutes(knots, solsticeDay(date, latitude))) / MINUTES_PER_HOUR;

  const fajr =
    sunrise -
    ("degrees" in method.fajr ? beforeSunrise(method.fajr.degrees) : seasonal(fajrKnots(latitude)));

  const maghrib =
    method.maghrib === null
      ? sunset
      : "degrees" in method.maghrib
        ? sunset + afterSunset(method.maghrib.degrees)
        : sunset + method.maghrib.minutes / MINUTES_PER_HOUR;

  const isha =
    "degrees" in method.isha
      ? sunset + afterSunset(method.isha.degrees)
      : "minutes" in method.isha
        ? maghrib + method.isha.minutes / MINUTES_PER_HOUR
        : sunset + seasonal(ishaKnots(latitude));

  const dayStart = Date.UTC(date.year, date.month - 1, date.day);
  const instant = (localSolarHour: number) =>
    dayStart + (localSolarHour - longitude / DEGREES_PER_HOUR) * MS_PER_HOUR;

  return {
    [SHIFT_TIMING.FAJR]: instant(fajr),
    [SHIFT_TIMING.SUNRISE]: instant(sunrise),
    [SHIFT_TIMING.DHUHR]: instant(midDay(GUESS_HOURS.dhuhr)),
    [SHIFT_TIMING.ASR]: instant(asrTime(GUESS_HOURS.asr)),
    [SHIFT_TIMING.MAGHRIB]: instant(maghrib),
    [SHIFT_TIMING.ISHA]: instant(isha),
  };
};

const addDays = ({ year, month, day }: CalendarDay, days: number): CalendarDay => {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

const TIMINGS: readonly ShiftTiming[] = Object.values(SHIFT_TIMING);

const byTiming = (value: (timing: ShiftTiming) => number): Record<ShiftTiming, number> => ({
  [SHIFT_TIMING.FAJR]: value(SHIFT_TIMING.FAJR),
  [SHIFT_TIMING.DHUHR]: value(SHIFT_TIMING.DHUHR),
  [SHIFT_TIMING.ASR]: value(SHIFT_TIMING.ASR),
  [SHIFT_TIMING.MAGHRIB]: value(SHIFT_TIMING.MAGHRIB),
  [SHIFT_TIMING.ISHA]: value(SHIFT_TIMING.ISHA),
  [SHIFT_TIMING.SUNRISE]: value(SHIFT_TIMING.SUNRISE),
});

/**
 * Each timing's largest change, in minutes, over a year of calendar days. Both
 * places read the same date, the saved place's, as the server rows pair them.
 */
export const yearlyShiftByTiming = (
  from: Coords,
  to: Coords,
  fromZone: string,
  calc: ShiftCalc,
  startAt: number
): Record<ShiftTiming, number> => {
  const wall = toZonedTime(startAt, fromZone);
  const firstDay = { year: wall.getFullYear(), month: wall.getMonth() + 1, day: wall.getDate() };
  const largest = byTiming(() => 0);
  for (let offset = 0; offset < SHIFT_HORIZON_DAYS; offset++) {
    const date = addDays(firstDay, offset);
    const a = dayTimings(from, date, calc);
    const b = dayTimings(to, date, calc);
    for (const timing of TIMINGS) {
      largest[timing] = Math.max(largest[timing], Math.abs(b[timing] - a[timing]) / MS_PER_MINUTE);
    }
  }
  return largest;
};

/** The largest change of any timing, in minutes, over the next year. */
export const maxYearlyShiftMinutes = (
  from: Coords,
  to: Coords,
  fromZone: string,
  calc: ShiftCalc,
  startAt: number
): number => Math.max(...Object.values(yearlyShiftByTiming(from, to, fromZone, calc, startAt)));
