import { useSyncExternalStore } from "react";

import { useNotificationStore } from "@/stores/notification";

/** True once the persisted notification settings have loaded from storage. */
export const useNotificationSettingsHydrated = (): boolean =>
  useSyncExternalStore(
    (onChange) => useNotificationStore.persist.onFinishHydration(onChange),
    () => useNotificationStore.persist.hasHydrated()
  );
