import { useEffect } from "react";
import { useCustomAthkarStore } from "@/stores/custom-athkar";

export const useInitializeCustomAthkar = () => {
  const initialize = useCustomAthkarStore((s) => s.initialize);
  const isInitialized = useCustomAthkarStore((s) => s.isInitialized);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return { isInitialized };
};
