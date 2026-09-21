import { useEffect, useState } from "react";

/** True only after `value` has been continuously true for `delayMs`; false immediately otherwise. */
export const useDelayedFlag = (value: boolean, delayMs: number): boolean => {
  const [delayed, setDelayed] = useState(false);

  // Cleared during render, so a dropped value never commits a frame that still reads true.
  if (!value && delayed) setDelayed(false);

  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return delayed;
};
