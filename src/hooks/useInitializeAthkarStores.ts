import { useEffect } from "react";

import { useMyAthkarStore } from "@/stores/my-athkar";
import { useCustomAthkarStore } from "@/stores/custom-athkar";

let loading: Promise<void> | null = null;

// In turn, so their writes never contend; each store flags its own failure.
// Callers during a load share it.
const loadAthkarStores = () =>
  (loading ??= (async () => {
    await useMyAthkarStore.getState().initialize();
    await useCustomAthkarStore.getState().initialize();
  })().finally(() => {
    loading = null;
  }));

// After a load already running, whose finished steps would miss a store that failed in it.
const retryAthkarStores = () => (loading ? loading.then(loadAthkarStores) : loadAthkarStores());

/** Loads both stores on mount; `retry` loads again any that failed. */
export const useInitializeAthkarStores = () => {
  const isMyAthkarInit = useMyAthkarStore((s) => s.isInitialized);
  const isCustomInit = useCustomAthkarStore((s) => s.isInitialized);
  const myAthkarFailed = useMyAthkarStore((s) => s.loadFailed);
  const customFailed = useCustomAthkarStore((s) => s.loadFailed);

  useEffect(() => {
    void loadAthkarStores();
  }, []);

  return { isMyAthkarInit, isCustomInit, myAthkarFailed, customFailed, retry: retryAthkarStores };
};
