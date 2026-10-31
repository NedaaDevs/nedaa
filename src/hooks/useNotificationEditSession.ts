import { useEffect } from "react";
import { useIsFocused } from "expo-router";

import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useNotificationStore } from "@/stores/notification";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("notifications");

// Opens a batch and returns its close; closing pays whatever the batch owes.
const openBatch = (): (() => void) => {
  let close = () => {};
  const closed = new Promise<void>((resolve) => {
    close = resolve;
  });

  useNotificationStore
    .getState()
    .withBatch(() => closed)
    .catch((error: unknown) => {
      log.e("EditSession", "flush failed", error instanceof Error ? error : undefined);
    });

  return close;
};

/** Batches every reschedule while `open` and the screen and app are in front. */
// Call it from the screen: a sheet body renders in a portal and sees no focus.
export const useNotificationEditSession = (open: boolean): void => {
  const isFocused = useIsFocused();
  const { isActive } = useAppVisibility();
  const holding = open && isFocused && isActive;

  // Cleanup runs on close, blur, background and any unmount, a throw's too.
  useEffect(() => {
    if (!holding) return;
    return openBatch();
  }, [holding]);
};
