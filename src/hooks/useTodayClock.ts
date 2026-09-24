import { createContext, use } from "react";

import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";

/** A simulated moment that overrides Today's clock while a debug run plays. */
export const SimulatedClockContext = createContext<Date | null>(null);

/** The moment Today is pinned to: a debug run's, or a screenshot's seed. */
export const useClockOverride = (): Date | null => {
  const simulated = use(SimulatedClockContext);
  const seed = useScreenshotSeed("prayer-times");
  if (simulated) return simulated;
  return seed ? new Date(seed.frozenNow) : null;
};

/** Today's clock: the pinned moment, or the device's. */
export const useTodayClock = (): Date => {
  const clock = useMinuteClock();
  return useClockOverride() ?? clock;
};
