import { useBoundaryClock } from "@/hooks/useBoundaryClock";

const MINUTE_MS = 60_000;

/** The device time on each minute boundary. */
export const useMinuteClock = (): Date => useBoundaryClock(MINUTE_MS);
