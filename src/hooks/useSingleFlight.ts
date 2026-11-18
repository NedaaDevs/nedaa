import { useRef } from "react";

/** Runs one write at a time; a call made while one runs is dropped. */
export const useSingleFlight = () => {
  const busy = useRef(false);
  return async (write: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await write();
    } finally {
      busy.current = false;
    }
  };
};
