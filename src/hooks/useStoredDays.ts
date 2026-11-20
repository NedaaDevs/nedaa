import { createContext, use } from "react";

import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { StoredDays } from "@/utils/phase";

/** Days that stand in for the stored ones, such as a preview's sample day. */
export const SampleDaysContext = createContext<StoredDays | null>(null);

/** The prayer days Today draws: a preview's sample, or the store's. */
export const useStoredDays = (): StoredDays => {
  const yesterday = usePrayerTimesStore((state) => state.yesterdayTimings);
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrow = usePrayerTimesStore((state) => state.tomorrowTimings);
  return use(SampleDaysContext) ?? { yesterday, today, tomorrow };
};
