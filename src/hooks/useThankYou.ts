import { useEffect, useRef, useState } from "react";

/** How long a thank-you stays before the tile turns back, from the design. */
const THANK_YOU_MS = 2600;

/** A thank-you that shows, holds and clears; a repeat restarts the hold. */
export const useThankYou = (): [thanked: boolean, thank: () => void] => {
  const [thanked, setThanked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const hold = timer;
    return () => clearTimeout(hold.current);
  }, []);

  const thank = () => {
    clearTimeout(timer.current);
    setThanked(true);
    timer.current = setTimeout(() => setThanked(false), THANK_YOU_MS);
  };

  return [thanked, thank];
};
