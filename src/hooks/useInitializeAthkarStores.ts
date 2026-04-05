import { useEffect } from "react";

import { AthkarDB } from "@/services/athkar-db";
import { useMyAthkarStore } from "@/stores/my-athkar";
import { useCustomAthkarStore } from "@/stores/custom-athkar";

/**
 * Serializes initialization of my-athkar and custom-athkar stores to prevent
 * concurrent SQLite write transactions from contending on the shared DB connection.
 *
 * Execution order: AthkarDB.initialize (cached) → my-athkar → custom-athkar.
 * Each step awaits the previous, ensuring only one transaction runs at a time.
 */
export const useInitializeAthkarStores = () => {
  const myAthkarInit = useMyAthkarStore((s) => s.initialize);
  const customInit = useCustomAthkarStore((s) => s.initialize);
  const isMyAthkarInit = useMyAthkarStore((s) => s.isInitialized);
  const isCustomInit = useCustomAthkarStore((s) => s.isInitialized);

  useEffect(() => {
    (async () => {
      await AthkarDB.initialize();
      await myAthkarInit();
      await customInit();
    })();
  }, [myAthkarInit, customInit]);

  return { isMyAthkarInit, isCustomInit };
};
