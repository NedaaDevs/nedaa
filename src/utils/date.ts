import { addDays, format, parse, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ar, enUS, ms } from "date-fns/locale";

// Enums
import { AppLocale } from "@/enums/app";

export type HijriDate = {
  year: number;
  month: number;
  day: number;
};

type DateRange = {
  yesterday: number;
  today: number;
  tomorrow: number;
};

/**
 * Converts a Unix timestamp (in seconds) to YYYYMMDD format
 * @param {number} timestamp
 * @param {string} timezone - target timezone
 */
export const timestampToDateInt = (timestamp: number, timezone: string): number => {
  const date = toZonedTime(timestamp * 1000, timezone);
  return parseInt(format(date, "yyyyMMdd"), 10);
};

/**
 * Gets current time in specified timezone as Date object for comparisons.
 * Warning: Date object methods (.getFullYear(), .toString(), etc.) will display
 * in user's local timezone, not the target timezone. Use helper functions for display purposes.
 * @param tz - IANA timezone string (e.g., 'Asia/Riyadh')
 * @returns Date object representing current time in specified timezone
 * @see {@link https://date-fns.org/docs/format format} from date-fns
 * @see getTimezoneYear, getTimezoneMonth for timezone-aware display values
 */
export const timeZonedNow = (tz: string): Date => {
  return toZonedTime(new Date(), tz);
};

/**
 * Gets the current year in the specified timezone
 * @param tz - IANA timezone string
 * @returns Current year as number in the specified timezone
 */
export const getTimezoneYear = (tz: string): number => {
  const zonedDate = toZonedTime(new Date(), tz);
  return parseInt(format(zonedDate, "yyyy"));
};

/**
 * Gets the current month in the specified timezone
 * @param tz - IANA timezone string
 * @returns Current month as number (1-12) in the specified timezone
 */
export const getTimezoneMonth = (tz: string): number => {
  const zonedDate = toZonedTime(new Date(), tz);
  return parseInt(format(zonedDate, "MM"));
};

/**
 * Converts a date string or Date object to integer format (YYYYMMDD)
 * @param date - Date string or Date object to convert
 * @returns number in YYYYMMDD format
 */
export const dateToInt = (date: string | Date): number => {
  if (date instanceof Date) {
    return parseInt(format(date, "yyyyMMdd"), 10);
  }

  // If it's a string, parse it with appropriate format
  const parsedDate = parse(date, "yyyy-MM-dd", new Date());
  return parseInt(format(parsedDate, "yyyyMMdd"), 10);
};

/**
 * Get three consecutive days (yesterday, today, tomorrow) as integers in YYYYMMDD format
 */
export const getThreeDayDateRange = (timezone: string): DateRange => {
  const now = toZonedTime(Date.now(), timezone);

  return {
    yesterday: dateToInt(subDays(now, 1)),
    today: parseInt(format(now, "yyyyMMdd"), 10),
    tomorrow: dateToInt(addDays(now, 1)),
  };
};

/**
 * Get a date-fns locale
 *
 * @param string locale
 *
 * @return Locale
 */
export const getDateLocale = (locale: AppLocale) => {
  switch (locale) {
    case "ar":
      return ar;
    case "ms":
      return ms;
    default:
      return enUS;
  }
};

/**
 * Checks if today is a Friday in the specified timezone
 *
 * @param {string} timezone - IANA timezone string
 * @returns {boolean} - True if date is Friday in the given timezone
 */
export const isFriday = (timezone: string): boolean => {
  const zonedDate = toZonedTime(Date.now(), timezone);
  return zonedDate.getDay() === 5; // 5 represents Friday (0 is Sunday, 1 is Monday, etc.)
};

export const HijriConverter = {
  /**
   * Convert Gregorian date to Hijri using Umm al-Qura algorithm
   */
  toHijri(date = new Date()): HijriDate {
    const gYear = date.getFullYear();
    const gMonth = date.getMonth() + 1;
    const gDay = date.getDate();

    // Calculate Julian Day Number
    let a = Math.floor((14 - gMonth) / 12);
    let y = gYear - a;
    let m = gMonth + 12 * a - 3;

    let jd =
      gDay +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) +
      1721119;

    // Accurate Umm al-Qura conversion constants
    const EPOCH = 1948084;
    const CYCLE_DAYS = 10631;
    const LUNAR_YEAR = 354.367;

    // Calculate days since Hijri epoch
    const daysSinceEpoch = jd - EPOCH;

    if (daysSinceEpoch < 0) {
      return { year: 1, month: 1, day: 1 };
    }

    // Calculate complete 30-year cycles
    const completeCycles = Math.floor(daysSinceEpoch / CYCLE_DAYS);
    const daysInCurrentCycle = daysSinceEpoch % CYCLE_DAYS;

    // Calculate year within current cycle with leap year correction
    let yearInCycle = Math.floor(daysInCurrentCycle / LUNAR_YEAR);
    const leapYears = Math.floor((11 * yearInCycle + 3) / 30);
    const adjustedDays = daysInCurrentCycle - leapYears;
    yearInCycle = Math.floor(adjustedDays / 354);

    // Final Hijri year
    const hYear = completeCycles * 30 + yearInCycle;

    // Calculate month and day
    const daysInYear =
      daysInCurrentCycle - yearInCycle * 354 - Math.floor((11 * yearInCycle + 3) / 30);
    const monthLengths = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];

    let hMonth = 1;
    let remainingDays = Math.floor(daysInYear);

    while (hMonth <= 12 && remainingDays >= monthLengths[hMonth - 1]) {
      remainingDays -= monthLengths[hMonth - 1];
      hMonth++;
    }

    const hDay = Math.max(1, remainingDays);

    return { year: hYear, month: hMonth, day: hDay };
  },

  /**
   * Convert Hijri date to Gregorian
   */
  toGregorian(hYear: number, hMonth: number, hDay: number) {
    // Approximate conversion - calculate total days from Hijri epoch
    let totalDays = Math.floor((hYear - 1) * 354.367);

    const hijriMonthDays = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
    for (let m = 1; m < hMonth; m++) {
      totalDays += hijriMonthDays[m - 1];
    }
    totalDays += hDay - 1;

    // Add to Gregorian epoch (July 16, 622 CE)
    const epochDate = new Date(622, 6, 16); // Month is 0-indexed
    const resultDate = new Date(epochDate.getTime() + totalDays * 24 * 60 * 60 * 1000);

    return resultDate;
  },

  /**
   * Add days to Hijri date
   */
  addDays(hijriDate: HijriDate, days: number): HijriDate {
    const gregorian = this.toGregorian(hijriDate.year, hijriDate.month, hijriDate.day);
    if (!gregorian) return hijriDate;

    const newGregorian = new Date(gregorian);
    newGregorian.setDate(gregorian.getDate() + days);

    return this.toHijri(newGregorian);
  },

  /**
   * Check if Hijri year is leap year
   */
  isLeapYear(hYear: number) {
    return (11 * hYear + 14) % 30 < 11;
  },
};
