import { useEffect } from "react";
import { useMyAthkarStore } from "@/stores/my-athkar";

export const useInitializeMyAthkar = () => {
  const initialize = useMyAthkarStore((s) => s.initialize);
  const isInitialized = useMyAthkarStore((s) => s.isInitialized);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return { isInitialized };
};
