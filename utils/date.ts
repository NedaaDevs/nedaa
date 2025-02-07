import { addDays, format, parse, subDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

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
 * Gets current time in specified timezone
 * @param tz - IANA timezone string (e.g., 'America/Los_Angeles')
 * @returns Date object representing current time in specified timezone
 */
export const timeZonedNow = (tz: string): Date => {
  return fromZonedTime(Date.now(), tz);
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

type DateRange = {
  yesterday: number;
  today: number;
  tomorrow: number;
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
