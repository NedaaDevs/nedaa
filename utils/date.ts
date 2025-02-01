import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/**
 * Converts a Unix timestamp (in seconds) to YYYYMMDD format
 * @param {number} timestamp
 * @param {string} timezone - target timezone
 */
export const timestampToDateInt = (timestamp: number, timezone: string): number => {
  const date = toZonedTime(timestamp * 1000, timezone);
  return parseInt(format(date, "yyyyMMdd"), 10);
};
