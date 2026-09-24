import { useEffect } from "react";
import * as Notifications from "expo-notifications";

import { handleNotificationResponse } from "@/utils/notificationResponse";

// Opens tapped notifications, the launch tap too. Held by the app shell, so a
// trip to the background never drops it.
export const useNotificationResponses = (canNavigate: boolean) => {
  useEffect(() => {
    if (!canNavigate) return;

    const launchTap = Notifications.getLastNotificationResponse();
    if (launchTap) {
      handleNotificationResponse(launchTap);
      Notifications.clearLastNotificationResponse();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );
    return () => subscription.remove();
  }, [canNavigate]);
};
