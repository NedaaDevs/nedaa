import { AppState } from "@/stores/app";
import { NotificationStore } from "@/stores/notification";

import * as Sentry from "@sentry/react-native";

export const performFirstRunSetup = async (
  appStore: AppState,
  notificationStore: NotificationStore,
) => {
  try {
    // Check existing notification permissions(This will update the store state with the current permissions)
    await notificationStore.checkPermissions();

    // Only request if first run and permissions aren't determined
    if (appStore.isFirstRun) {
      const granted = await notificationStore.requestPermissions();

      if (!granted) {
        console.log("User declined initial permission request");
      }

      // Mark first run as complete
      appStore.setIsFirstRun(false);
    }
  } catch (error) {
    console.error("First run setup failed:", error);
    Sentry.captureException(error);
  }
};
