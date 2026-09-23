import { createContext, use } from "react";

import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";

/** A simulated moment that overrides Today's clock while a debug run plays. */
export const SimulatedClockContext = createContext<Date | null>(null);

/** Today's clock: a debug run's, a screenshot's seed, or the device's. */
export const useTodayClock = (): Date => {
  const clock = useMinuteClock();
  const seed = useScreenshotSeed("prayer-times");
  const simulated = use(SimulatedClockContext);
  if (simulated) return simulated;
  return seed ? new Date(seed.frozenNow) : clock;
};
