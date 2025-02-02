import type { PrayerTimings, OtherTimings } from "@/types/prayerTimes";

export const isPrayerTimings = (obj: unknown): obj is PrayerTimings => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as PrayerTimings).fajr === "string" &&
    typeof (obj as PrayerTimings).dhuhr === "string" &&
    typeof (obj as PrayerTimings).asr === "string" &&
    typeof (obj as PrayerTimings).maghrib === "string" &&
    typeof (obj as PrayerTimings).isha === "string"
  );
};

export const isOtherTimings = (obj: unknown): obj is OtherTimings => {
  const objAsAny = obj as any;
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof objAsAny.sunrise === "string" &&
    typeof objAsAny.sunset === "string" &&
    typeof objAsAny.imsak === "string" &&
    typeof objAsAny.midnight === "string" &&
    typeof (objAsAny.firstthird || objAsAny.firstThird) === "string" &&
    typeof (objAsAny.lastthird || objAsAny.lastThird) === "string"
  );
};
