import { useSyncExternalStore } from "react";

/** The load-state half of a persisted zustand store. */
type PersistLoad = {
  hasHydrated: () => boolean;
  onFinishHydration: (listener: () => void) => () => void;
};

/** True once a persisted store has read its saved record; its defaults show until then. */
export const usePersistHydrated = (persist: PersistLoad): boolean =>
  useSyncExternalStore(
    (onChange) => persist.onFinishHydration(onChange),
    () => persist.hasHydrated()
  );
