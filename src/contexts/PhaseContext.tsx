import { createContext, use, useEffect, useState } from "react";
import { AppState } from "react-native";

import { APP_STATE } from "@/constants/AppState";
import type { Phase } from "@/constants/Phase";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { nextPhaseStart, phaseAt } from "@/utils/phase";

/** A timer can fire a little early; waking just after the boundary lands in the new phase. */
const WAKE_MARGIN_MS = 1000;

/**
 * The prayer-day phase now, or undefined before the day's times are known. It
 * re-renders when a phase begins, when the day's times change and when the app
 * returns to the foreground — never on a clock tick, because the root reads it.
 */
export const usePrayerPhaseSource = (): Phase | undefined => {
  const yesterday = usePrayerTimesStore((state) => state.yesterdayTimings);
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrow = usePrayerTimesStore((state) => state.tomorrowTimings);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const days = { yesterday, today, tomorrow };
    const current = new Date();
    // New times (a new day, a new city) can move the phase without a boundary passing.
    const stale = phaseAt(current, days) !== phaseAt(now, days);
    const next = nextPhaseStart(current, days);
    const delay = stale
      ? 0
      : next
        ? next.getTime() - current.getTime() + WAKE_MARGIN_MS
        : undefined;
    if (delay === undefined) return;
    const timer = setTimeout(() => setNow(new Date()), delay);
    return () => clearTimeout(timer);
  }, [yesterday, today, tomorrow, now]);

  // Timers do not run while the app is suspended.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === APP_STATE.ACTIVE) setNow(new Date());
    });
    return () => subscription.remove();
  }, []);

  return phaseAt(now, { yesterday, today, tomorrow });
};

export const PhaseContext = createContext<Phase | undefined>(undefined);

/** The phase the root resolved; undefined before the day's times load. */
export const usePhase = (): Phase | undefined => use(PhaseContext);
