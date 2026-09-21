import type { PrayerTimings, OtherTimings, OtherTimingName, PrayerName } from "@/types/prayerTimes";
import { OTHER_TIMING, OTHER_TIMING_NAMES, PRAYER_ID } from "@/constants/Prayer";

export const isPrayerTimings = (obj: unknown): obj is PrayerTimings => {
  const parsedObj = obj as Record<PrayerName, string>;
  const requiredKeys: PrayerName[] = [
    PRAYER_ID.FAJR,
    PRAYER_ID.DHUHR,
    PRAYER_ID.ASR,
    PRAYER_ID.MAGHRIB,
    PRAYER_ID.ISHA,
  ];

  return (
    typeof obj === "object" &&
    obj !== null &&
    requiredKeys.every((key) => typeof parsedObj[key] === "string")
  );
};

export const isOtherTimings = (obj: unknown): obj is OtherTimings => {
  const parsedObj = obj as Record<string, string>;
  const requiredKeys: OtherTimingName[] = [...OTHER_TIMING_NAMES];

  return (
    typeof obj === "object" &&
    obj !== null &&
    requiredKeys.every((key) => {
      // Handle the camel case for firstthird/lastthird
      if (key === OTHER_TIMING.FIRST_THIRD && typeof parsedObj.firstthird === "string") return true;
      if (key === OTHER_TIMING.LAST_THIRD && typeof parsedObj.lastthird === "string") return true;
      return typeof parsedObj[key] === "string";
    })
  );
};
