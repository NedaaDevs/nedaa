// Stores
import locationStore from "@/stores/location";

// Utils
import { timeZonedNow, timestampToDateInt, dateToInt } from "@/utils/date";

// Constant
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Types
import type { Athkar, AthkarProgress, AthkarType } from "@/types/athkar";

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
 */
export const getTodayInt = (timezone: string): number => {
  return timestampToDateInt(Date.now() / 1000, timezone);
};

/**
 * Convert date integer to ISO date string
 */
export const dateIntToString = (dateInt: number): string => {
  const dateStr = dateInt.toString();
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
};

/**
 * Check if a date string is from today
 */
export const isFromToday = (dateString: string, timezone: string): boolean => {
  try {
    // Parse the date string to ensure it's valid
    const itemDate = new Date(dateString);
    if (isNaN(itemDate.getTime())) {
      console.warn("[Athkar] Invalid date string:", dateString);
      return false;
    }

    const todayInt = getTodayInt(timezone);
    const itemDateInt = dateToInt(itemDate);

    return todayInt === itemDateInt;
  } catch (error) {
    console.error("[Athkar] isFromToday error:", error);
    return false;
  }
};

export const generateReferenceId = (athkarId: string, type: AthkarType): string => {
  return `${athkarId}-${type}`;
};

export const extractBaseId = (athkarId: string): string => {
  return athkarId.split("-")[0];
};

export const filterProgressByType = (
  progress: AthkarProgress[],
  type: AthkarType
): AthkarProgress[] => {
  return progress.filter((p) => p.athkarId.includes(`-${type}`));
};

export const filterAthkarByType = (athkarList: Athkar[], type: AthkarType): Athkar[] => {
  return athkarList
    .filter((a) => a.type === type || a.type === ATHKAR_TYPE.ALL)
    .sort((a, b) => a.order - b.order);
};

export const isAthkarCompleted = (current: number, total: number): boolean => {
  return current >= total;
};

// Session completion
export const isSessionComplete = (progress: AthkarProgress[], type: AthkarType): boolean => {
  const sessionProgress = filterProgressByType(progress, type);
  return sessionProgress.length > 0 && sessionProgress.every((p) => p.completed);
};

// Progress creation
export const createProgressItem = (
  athkar: Athkar,
  type: AthkarType,
  timezone?: string
): AthkarProgress => {
  try {
    const p = {
      athkarId: generateReferenceId(`${athkar.order}`, type),
      currentCount: 0,
      completed: false,
    };

    return p;
  } catch (error) {
    console.error("error:", error);
    return {
      athkarId: generateReferenceId(`${athkar.order}`, type),
      currentCount: 0,
      completed: false,
    };
  }
};

/**
 * Convert DB progress format to store format
 */
export const convertDBProgressToStoreFormat = (
  morningProgress: Record<string, { count: number; completed: boolean }>,
  eveningProgress: Record<string, { count: number; completed: boolean }>,
  timezone: string
): AthkarProgress[] => {
  const now = getTimestampForTimezone(timezone);
  const progress: AthkarProgress[] = [];

  // Convert morning progress
  Object.entries(morningProgress).forEach(([athkarId, data]) => {
    progress.push({
      athkarId,
      currentCount: data.count,
      completed: data.completed,
    });
  });

  // Convert evening progress
  Object.entries(eveningProgress).forEach(([athkarId, data]) => {
    progress.push({
      athkarId,
      currentCount: data.count,
      completed: data.completed,
    });
  });

  return progress;
};

export const getTimestampForTimezone = (timezone: string): string => {
  const now = timeZonedNow(timezone);
  return now.toISOString();
};

export const clampIndex = (index: number, maxLength: number): number => {
  return Math.max(0, Math.min(index, maxLength - 1));
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

// Find the index of the first not completed Thikir to start from(If all done default to 0)
export const getNextAthkarIndex = (
  progressList: AthkarProgress[],
  athkarList: Athkar[],
  type: AthkarType
): string => {
  const firstThikir = `1-${type}`;
  // Early return for empty progress
  if (!progressList || progressList.length === 0) {
    return firstThikir;
  }

  const typeProgress = filterProgressByType(progressList, type);
  const filteredList = filterAthkarByType(athkarList, type);

  // Early return if no progress for this type
  if (!typeProgress || typeProgress.length === 0) {
    return firstThikir;
  }

  const nextIncompleteThikir = typeProgress.find((p) => !p.completed);

  if (!nextIncompleteThikir) {
    return firstThikir; // All completed, start from beginning
  }

  const thikir = filteredList.find(
    (thikir) => `${thikir.order}-${type}` === nextIncompleteThikir.athkarId
  );

  if (thikir) {
    return `${thikir.order}-${type}`;
  }

  return firstThikir;
};
