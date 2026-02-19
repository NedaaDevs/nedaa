import { addDays, format, parse, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ar, enUS } from "date-fns/locale";

// Enums
import { AppLocale } from "@/enums/app";

export type { HijriDate } from "hijri-native";
export * as HijriNative from "hijri-native";

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
    // case "ms":
    //   return ms;
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

/**
 * Format a number hour-minute to 24 style
 * @param {number} hour - Hour number
 * @param {number} minute - Minute number
 * @returns {string} - Formatted string
 */
export const formatTime24Hour = (hour: number, minute: number) => {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
};

/**
 * Format a number hour-minute to 12 style
 * @param {number} hour - Hour number
 * @param {number} minute - Minute number
 * @returns {string} - Formatted string
 */
export const formatTime12Hour = (hour: number, minute: number) => {
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
};
