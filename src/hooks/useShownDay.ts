import { useTodayClock } from "@/hooks/useTodayClock";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { prayerDayAt, storedDayList } from "@/utils/phase";

type ShownDay = {
  now: Date;
  /** The prayer day at the clock, Fajr to Fajr; null until times load. */
  day: DayPrayerTimes | null;
  /** The stored day after it, if any. */
  following: DayPrayerTimes | null;
};

/** Today's clock, the prayer day it falls in, and the day after. */
export const useShownDay = (): ShownDay => {
  const now = useTodayClock();
  const yesterday = usePrayerTimesStore((state) => state.yesterdayTimings);
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrow = usePrayerTimesStore((state) => state.tomorrowTimings);
  const days = { yesterday, today, tomorrow };
  // The store rolls its days on launch or foreground, not at midnight.
  const day = prayerDayAt(now, days) ?? today;
  const stored = storedDayList(days);
  const following = day ? (stored[stored.indexOf(day) + 1] ?? null) : null;
  return { now, day, following };
};
