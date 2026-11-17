import { useEffect, useState } from "react";

import { useAthkarStore } from "@/stores/athkar";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("athkar");

/** Loads today's counts once the lists exist; `settled` after a load ends. */
export const useAthkarDayLoad = (): { settled: boolean; retry: () => void } => {
  const hasLists = useAthkarStore(
    (s) => s.morningAthkarList.length > 0 || s.eveningAthkarList.length > 0
  );
  const initializeTodayData = useAthkarStore((s) => s.initializeTodayData);
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<number | null>(null);

  useEffect(() => {
    if (!hasLists) return;
    let live = true;
    initializeTodayData()
      .catch((error: unknown) =>
        log.e(
          "Session",
          "today's athkar did not load",
          error instanceof Error ? error : new Error(String(error))
        )
      )
      .finally(() => {
        if (live) setSettled(attempt);
      });
    return () => {
      live = false;
    };
  }, [hasLists, attempt, initializeTodayData]);

  return { settled: settled === attempt, retry: () => setAttempt((n) => n + 1) };
};
