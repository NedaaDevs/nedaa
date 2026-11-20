import { usePersistHydrated } from "@/hooks/usePersistHydrated";
import { useNotificationStore } from "@/stores/notification";

/** True once the persisted notification settings have loaded from storage. */
export const useNotificationSettingsHydrated = (): boolean =>
  usePersistHydrated(useNotificationStore.persist);
