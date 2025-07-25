// Stores
import { useLocationStore } from "@/stores/location";

// Utils
import { timeZonedNow, timestampToDateInt, dateToInt } from "@/utils/date";

// Constant
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Types
import type { Athkar, AthkarProgress, AthkarType } from "@/types/athkar";

// List of locales that support athkar feature
export const ATHKAR_SUPPORTED_LOCALES = ["ar", "en"];

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

export const getToday = (timezone?: string): string => {
  try {
    if (timezone) {
      const now = timeZonedNow(timezone);
      return now.toDateString();
    }

    // Fallback: try to get timezone from location store
    const locationStore = useLocationStore.getState();
    if (locationStore?.locationDetails?.timezone) {
      const now = timeZonedNow(locationStore.locationDetails.timezone);
      return now.toDateString();
    }

    // Final fallback to local time
    return new Date().toDateString();
  } catch (error) {
    console.error("error:", error);
    // Fallback to local time if timezone is invalid
    return new Date().toDateString();
  }
};

export const getTodayAsInt = (timezone?: string): number => {
  try {
    if (timezone) {
      return timestampToDateInt(Date.now() / 1000, timezone);
    }

    // Fallback: try to get timezone from location store
    const locationStore = useLocationStore.getState();
    if (locationStore?.locationDetails?.timezone) {
      return timestampToDateInt(Date.now() / 1000, locationStore.locationDetails.timezone);
    }

    // Final fallback
    return dateToInt(new Date());
  } catch (error) {
    console.error("error:", error);
    return dateToInt(new Date());
  }
};

export const isFromToday = (dateString: string, timezone?: string): boolean => {
  try {
    // Compare as date integers
    const todayInt = getTodayAsInt(timezone);
    const itemDateInt = dateToInt(new Date(dateString));
    return todayInt === itemDateInt;
  } catch (error) {
    console.error("error:", error);
    // Fallback to string comparison
    const today = getToday(timezone);
    const itemDate = new Date(dateString).toDateString();
    return today === itemDate;
  }
};

// ID generation helpers
export const generateProgressId = (athkarId: string, type: AthkarType): string => {
  return `${athkarId}-${type}-${Date.now()}`;
};

export const generateReferenceId = (athkarId: string, type: AthkarType): string => {
  return `${athkarId}-${type}`;
};

export const extractBaseId = (athkarId: string): string => {
  return athkarId.split("-")[0];
};

// Progress filtering
export const filterTodayProgress = (progress: any[], timezone?: string) => {
  try {
    // Get timezone from location store if not provided
    if (!timezone) {
      const locationStore = useLocationStore.getState();
      timezone = locationStore?.locationDetails?.timezone;
    }

    return progress.filter((p) => isFromToday(p.date, timezone));
  } catch (error) {
    console.error("error:", error);
    // Fallback to simple date comparison
    return progress.filter((p) => isFromToday(p.date));
  }
};

export const filterProgressByType = (progress: any[], type: AthkarType): AthkarProgress[] => {
  return progress.filter((p) => p.athkarId.includes(`-${type}`));
};

export const filterAthkarByType = (athkarList: any[], type: AthkarType) => {
  return athkarList
    .filter((a) => a.type === type || a.type === ATHKAR_TYPE.ALL)
    .sort((a, b) => a.order - b.order);
};

// Progress calculation
export const calculateProgress = (current: number, total: number): number => {
  return total > 0 ? (current / total) * 100 : 0;
};

export const isAthkarCompleted = (current: number, total: number): boolean => {
  return current >= total;
};

// Session completion
export const isSessionComplete = (progress: any[], type: AthkarType): boolean => {
  const sessionProgress = filterProgressByType(progress, type);
  return sessionProgress.length > 0 && sessionProgress.every((p) => p.completed);
};

export const areBothSessionsComplete = (progress: any[]): boolean => {
  return (
    isSessionComplete(progress, ATHKAR_TYPE.MORNING) &&
    isSessionComplete(progress, ATHKAR_TYPE.EVENING)
  );
};

// Streak calculation
export const calculateDaysDifference = (
  date1: string,
  date2: string,
  timezone?: string
): number => {
  try {
    // Use timezone-aware comparison if available
    if (timezone) {
      const d1 = new Date(date1);
      const d2 = timeZonedNow(timezone);
      return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Fallback to simple date comparison
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  } catch (error) {
    console.error("error:", error);
    // Fallback calculation
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }
};

export const shouldIncrementStreak = (
  daysDiff: number,
  toleranceDays: number,
  isPaused: boolean
): boolean => {
  if (isPaused) return false;
  return daysDiff === 1 || daysDiff <= toleranceDays + 1;
};

// Progress creation
export const createProgressItem = (athkar: any, type: AthkarType, timezone?: string) => {
  try {
    // Use timezone-aware timestamp
    const now = timezone ? timeZonedNow(timezone) : new Date();

    return {
      id: generateProgressId(athkar.id, type),
      athkarId: generateReferenceId(athkar.id, type),
      currentCount: 0,
      completed: false,
      date: now.toISOString(),
      lastUpdated: now.toISOString(),
    };
  } catch (error) {
    console.error("error:", error);
    // Fallback to local time
    const now = new Date();
    return {
      id: generateProgressId(athkar.id, type),
      athkarId: generateReferenceId(athkar.id, type),
      currentCount: 0,
      completed: false,
      date: now.toISOString(),
      lastUpdated: now.toISOString(),
    };
  }
};

export const getTimestampForTimezone = (timezone?: string): string => {
  try {
    if (timezone) {
      const now = timeZonedNow(timezone);
      return now.toISOString();
    }

    // Try to get timezone from location store
    const locationStore = useLocationStore.getState();
    if (locationStore?.locationDetails?.timezone) {
      const now = timeZonedNow(locationStore.locationDetails.timezone);
      return now.toISOString();
    }

    return new Date().toISOString();
  } catch (error) {
    console.error("error:", error);
    return new Date().toISOString();
  }
};

export const clampIndex = (index: number, maxLength: number): number => {
  return Math.max(0, Math.min(index, maxLength - 1));
};

export const getCurrentAthkarPeriod = (timezone?: string): Exclude<AthkarType, "all"> => {
  try {
    let currentTime: Date;

    if (timezone) {
      currentTime = timeZonedNow(timezone);
    } else {
      // Try to get timezone from location store
      const locationStore = useLocationStore.getState();
      if (locationStore?.locationDetails?.timezone) {
        currentTime = timeZonedNow(locationStore.locationDetails.timezone);
      } else {
        currentTime = new Date();
      }
    }

    const hour = currentTime.getHours();

    // Morning athkar: 00:00 - 11:59 (AM hours)
    // Evening athkar: 12:00 - 23:59 (PM hours)
    if (hour >= 0 && hour < 12) {
      return ATHKAR_TYPE.MORNING;
    } else {
      return ATHKAR_TYPE.EVENING;
    }
  } catch (error) {
    console.error("error:", error);
    // Fallback to local time
    const hour = new Date().getHours();
    return hour >= 0 && hour < 12 ? ATHKAR_TYPE.MORNING : ATHKAR_TYPE.EVENING;
  }
};

// Helper to check if it's currently morning athkar time
export const isAthkarMorningPeriod = (timezone?: string): boolean => {
  return getCurrentAthkarPeriod(timezone) === ATHKAR_TYPE.MORNING;
};

// Helper to check if it's currently evening athkar time
export const isAthkarEveningPeriod = (timezone?: string): boolean => {
  return getCurrentAthkarPeriod(timezone) === ATHKAR_TYPE.EVENING;
};

// Find the index of the first not completed Thikir to start from(If all done default to 0)
export const athkarIndexToStartFrom = (
  progressList: AthkarProgress[],
  athkarList: Athkar[],
  type: AthkarType
): number => {
  // Early return for empty progress
  if (!progressList || progressList.length === 0) {
    return 0;
  }

  const typeProgress = filterProgressByType(progressList, type);

  // Early return if no progress for this type
  if (!typeProgress || typeProgress.length === 0) {
    return 0;
  }

  const incompleteThikir = typeProgress.find((p) => !p.completed);

  if (!incompleteThikir) {
    return 0; // All completed, start from beginning
  }

  const baseId = extractBaseId(incompleteThikir.athkarId);

  // Find the actual index in the filtered athkar list
  const index = athkarList.findIndex((athkar) => athkar.id === baseId);

  return Math.max(0, index);
};
