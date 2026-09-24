import { useEffect, useState } from "react";

import { useAppVisibility } from "@/hooks/useAppVisibility";

/**
 * The device time, re-rendering on each whole `periodMs` while `enabled`. Each
 * tick schedules the next from the wall clock, so ticks never drift; timers
 * stop in the background, so a return ticks at once and re-aligns.
 */
export const useBoundaryClock = (periodMs: number, enabled = true): Date => {
  const [now, setNow] = useState(() => new Date());
  const { becameActiveAt } = useAppVisibility();

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, periodMs - (Date.now() % periodMs));
    };
    timer = setTimeout(tick, becameActiveAt ? 0 : periodMs - (Date.now() % periodMs));
    return () => clearTimeout(timer);
  }, [periodMs, enabled, becameActiveAt]);

  return now;
};
