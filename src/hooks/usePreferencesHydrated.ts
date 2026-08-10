import { useSyncExternalStore } from "react";

import { usePreferencesStore } from "@/stores/preferences";

/**
 * True once the persisted preferences have loaded. The store hydrates
 * asynchronously from expo-sqlite/kv-store, so consumers that must not see
 * defaults (text size, offer flags) wait on this.
 */
export const usePreferencesHydrated = (): boolean =>
  useSyncExternalStore(
    (onChange) => usePreferencesStore.persist.onFinishHydration(onChange),
    () => usePreferencesStore.persist.hasHydrated()
  );
