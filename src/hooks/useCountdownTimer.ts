import { useEffect, useState } from "react";

import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useClockOverride } from "@/hooks/useTodayClock";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { focusCount, type CountSettings, type FocusCount } from "@/utils/focusCount";

/** The device time on each second while `enabled`; the last tick otherwise. */
const useSecondClock = (enabled: boolean): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;
    // Aligned to the second, so ticks are evenly spaced rather than drifting.
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => setNow(new Date()), 1000);
      },
      1000 - (Date.now() % 1000)
    );
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [enabled]);

  return now;
};

/** The focus figure: until the next prayer, or since the last when flipped. */
export const useCountdownTimer = (flipped: boolean): FocusCount | null => {
  const yesterday = usePrayerTimesStore((state) => state.yesterdayTimings);
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrow = usePrayerTimesStore((state) => state.tomorrowTimings);
  const seconds = usePreferencesStore((state) => state.showSeconds);
  const iqamaEnabled = usePreferencesStore((state) => state.iqamaCountUpEnabled);
  const iqamaMinutes = usePreferencesStore((state) => state.iqamaCountUpMinutes);
  const settings: CountSettings = {
    seconds,
    iqama: { enabled: iqamaEnabled, minutes: iqamaMinutes },
  };
  const days = { yesterday, today, tomorrow };

  const override = useClockOverride();
  const minute = useMinuteClock();
  const coarse = focusCount(override ?? minute, days, settings, flipped);
  // Seconds matter only while the figure shows them; a pinned clock stays put.
  const ticking = Boolean(coarse?.precise) && !override;
  const second = useSecondClock(ticking);
  // The second clock holds its last tick until the first new one; take the later.
  const latest = second > minute ? second : minute;

  return ticking ? focusCount(latest, days, settings, flipped) : coarse;
};
