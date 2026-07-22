import { useEffect, useState } from "react";

/** True only after `value` has been continuously true for `delayMs`; false immediately otherwise. */
export const useDelayedFlag = (value: boolean, delayMs: number): boolean => {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!value) {
      setDelayed(false);
      return;
    }
    const timer = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return delayed;
};
