import type { PrayerTimings, OtherTimings, OtherTimingName, PrayerName } from "@/types/prayerTimes";

export const isPrayerTimings = (obj: unknown): obj is PrayerTimings => {
  const parsedObj = obj as Record<PrayerName, string>;
  const requiredKeys: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

  return (
    typeof obj === "object" &&
    obj !== null &&
    requiredKeys.every((key) => typeof parsedObj[key] === "string")
  );
};

export const isOtherTimings = (obj: unknown): obj is OtherTimings => {
  const parsedObj = obj as Record<string, string>;
  const requiredKeys: OtherTimingName[] = [
    "sunrise",
    "sunset",
    "imsak",
    "midnight",
    "firstThird",
    "lastThird",
  ];

  return (
    typeof obj === "object" &&
    obj !== null &&
    requiredKeys.every((key) => {
      // Handle the camel case for firstThird/lastThird
      if (key === "firstThird" && typeof parsedObj.firstthird === "string") return true;
      if (key === "lastThird" && typeof parsedObj.lastthird === "string") return true;
      return typeof parsedObj[key] === "string";
    })
  );
};
