import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";

/** Today's clock: the device's, or the seeded moment while a screenshot is taken. */
export const useTodayClock = (): Date => {
  const clock = useMinuteClock();
  const seed = useScreenshotSeed("prayer-times");
  return seed ? new Date(seed.frozenNow) : clock;
};
