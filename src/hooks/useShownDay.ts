import { useTodayClock } from "@/hooks/useTodayClock";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { storedDayList, storedDayOn } from "@/utils/phase";

type ShownDay = {
  now: Date;
  /** The stored day the clock falls on; null until times load. */
  day: DayPrayerTimes | null;
  /** The stored day after it, if any. */
  following: DayPrayerTimes | null;
};

/** Today's clock, the stored day it falls on, and the day after. */
export const useShownDay = (): ShownDay => {
  const now = useTodayClock();
  const yesterday = usePrayerTimesStore((state) => state.yesterdayTimings);
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrow = usePrayerTimesStore((state) => state.tomorrowTimings);
  const days = { yesterday, today, tomorrow };
  // The store rolls its days on launch or foreground, not at midnight.
  const day = storedDayOn(now, days) ?? today;
  const stored = storedDayList(days);
  const following = day ? (stored[stored.indexOf(day) + 1] ?? null) : null;
  return { now, day, following };
};
