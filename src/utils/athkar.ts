// Stores
import locationStore from "@/stores/location";

// Utils
import { timeZonedNow, timestampToDateInt } from "@/utils/date";

// Constant
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Types
import type { AthkarType } from "@/types/athkar";

// List of locales that support athkar feature
export const ATHKAR_SUPPORTED_LOCALES = ["ar", "en", "ur"];

/**
 * Check if the current locale supports athkar feature
 * @param locale
 * @returns boolean indicating if athkar is supported
 */
export const isAthkarSupported = (locale: string): boolean => {
  // Extract the base language code (e.g., 'ar' from 'ar-SA')
  const baseLocale = locale.split("-")[0];
  return ATHKAR_SUPPORTED_LOCALES.includes(baseLocale);
};

/**
 * Get today's date as an integer (YYYYMMDD format)
 * @param timezone
 *
 * @returns date integer (20250731)
 */
export const getTodayInt = (timezone: string): number => {
  return timestampToDateInt(Date.now() / 1000, timezone);
};

/**
 * Convert date integer to ISO date string
 * @param dateInt (20250731)
 *
 * @returns string (2025-07-31)
 */
export const dateIntToString = (dateInt: number): string => {
  const dateStr = dateInt.toString();
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
};

export const getCurrentAthkarPeriod = (): Exclude<AthkarType, "all"> => {
  const tz = locationStore.getState().locationDetails.timezone;
  const currentTime = timeZonedNow(tz);
  const hour = currentTime.getHours();

  // Morning athkar: 00:00 - 11:59 (AM hours)
  // Evening athkar: 12:00 - 23:59 (PM hours)
  if (hour >= 0 && hour < 12) {
    return ATHKAR_TYPE.MORNING;
  } else {
    return ATHKAR_TYPE.EVENING;
  }
};

// Helper to check if it's currently morning athkar time
export const isAthkarMorningPeriod = (): boolean => {
  return getCurrentAthkarPeriod() === ATHKAR_TYPE.MORNING;
};

// Helper to check if it's currently evening athkar time
export const isAthkarEveningPeriod = (): boolean => {
  return getCurrentAthkarPeriod() === ATHKAR_TYPE.EVENING;
};
