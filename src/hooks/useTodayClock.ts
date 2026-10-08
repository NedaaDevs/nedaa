import { createContext, use } from "react";

import { useMinuteClock } from "@/hooks/useMinuteClock";
import { screenshotNow } from "@/screenshot-mode/clock";

/** A simulated moment that overrides Today's clock while a debug run plays. */
export const SimulatedClockContext = createContext<Date | null>(null);

/** The moment the clock is pinned to: a debug run's, or a screenshot build's. */
export const useClockOverride = (): Date | null => use(SimulatedClockContext) ?? screenshotNow();

/** Today's clock: the pinned moment, or the device's. */
export const useTodayClock = (): Date => {
  const clock = useMinuteClock();
  return useClockOverride() ?? clock;
};
