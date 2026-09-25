import { useEffect, useState } from "react";

import { useAppVisibility } from "@/hooks/useAppVisibility";

/** The device time, updated on each whole `periodMs` while `enabled`. */
export const useBoundaryClock = (periodMs: number, enabled = true): Date => {
  const [now, setNow] = useState(() => new Date());
  const { becameActiveAt } = useAppVisibility();

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    // Aimed at the next boundary by the wall clock, so ticks never drift.
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, periodMs - (Date.now() % periodMs));
    };
    // Timers stop in the background; a return ticks at once.
    timer = setTimeout(tick, becameActiveAt ? 0 : periodMs - (Date.now() % periodMs));
    return () => clearTimeout(timer);
  }, [periodMs, enabled, becameActiveAt]);

  return now;
};
