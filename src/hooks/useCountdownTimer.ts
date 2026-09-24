import { useBoundaryClock } from "@/hooks/useBoundaryClock";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useClockOverride } from "@/hooks/useTodayClock";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { focusCount, type CountSettings, type FocusCount } from "@/utils/focusCount";

const SECOND_MS = 1000;

/** The focus figure: until the next prayer, or since the last when flipped. */
export const useCountdownTimer = (flipped: boolean): FocusCount | null => {
  const yesterday = usePrayerTimesStore((state) => state.yesterdayTimings);
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrow = usePrayerTimesStore((state) => state.tomorrowTimings);
  const seconds = usePreferencesStore((state) => state.showSeconds);
  const settings: CountSettings = {
    seconds,
  };
  const days = { yesterday, today, tomorrow };

  const override = useClockOverride();
  const minute = useMinuteClock();
  const coarse = focusCount(override ?? minute, days, settings, flipped);
  // Seconds matter only while the figure shows them; a pinned clock stays put.
  const ticking = Boolean(coarse?.precise) && !override;
  const second = useBoundaryClock(SECOND_MS, ticking);
  // The second clock holds its last tick until the first new one; take the later.
  const latest = second > minute ? second : minute;

  return ticking ? focusCount(latest, days, settings, flipped) : coarse;
};
