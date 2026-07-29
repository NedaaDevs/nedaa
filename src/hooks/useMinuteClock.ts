import { useEffect, useState } from "react";

/**
 * Current device time, re-rendering once per minute on the minute boundary.
 * Feed it to anything whose output depends on the clock rather than on state.
 */
export const useMinuteClock = (): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, msToNextMinute);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return now;
};
