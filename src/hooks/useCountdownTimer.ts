import type { PrayerId } from "@/constants/Prayer";
import { useBoundaryClock } from "@/hooks/useBoundaryClock";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useClockOverride } from "@/hooks/useTodayClock";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { focusCount, type CountSettings, type FocusCount } from "@/utils/focusCount";
import type { StoredDays } from "@/utils/phase";
import { prayerCount } from "@/utils/prayerCount";

const SECOND_MS = 1000;

/** Reads a figure at `now` from the stored days. */
type Counter = (now: Date, days: StoredDays, settings: CountSettings) => FocusCount | null;

/** A figure on Today's clock, ticking each second while it shows seconds. */
const useFigure = (count: Counter): FocusCount | null => {
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
  const coarse = count(override ?? minute, days, settings);
  // Seconds matter only while the figure shows them; a pinned clock stays put.
  const ticking = Boolean(coarse?.precise) && !override;
  const second = useBoundaryClock(SECOND_MS, ticking);
  // The second clock holds its last tick until the first new one; take the later.
  const latest = second > minute ? second : minute;

  return ticking ? count(latest, days, settings) : coarse;
};

/** The focus figure: until the next prayer, or since the last when flipped. */
export const useCountdownTimer = (flipped: boolean): FocusCount | null =>
  useFigure((now, days, settings) => focusCount(now, days, settings, flipped));

/** One prayer's figure, to or from the time its Today card shows. */
export const usePrayerCountdown = (id: PrayerId, flipped: boolean): FocusCount | null =>
  useFigure((now, days, settings) => prayerCount(id, now, days, settings, flipped));
