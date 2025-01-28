import * as Sentry from "@sentry/react-native";

// Types
import { LocationStore } from "@/types/location";
import { AppState } from "@/types/app";
import { NotificationState } from "@/types/notifications";

export const performFirstRunSetup = async (
  appStore: AppState,
  notificationStore: NotificationState,
  locationStore: LocationStore,
) => {
  try {
    // Check existing notification permissions(This will update the store state with the current permissions)
    await notificationStore.refreshPermissions();
    await locationStore.checkPermissions();

    // Only request if first run and permissions aren't determined
    if (appStore.isFirstRun) {
      const grantedNotificationsPermission =
        await notificationStore.requestNotificationPermission();
      const grantedLocationPermission =
        await locationStore.requestPermissions();

      if (!grantedNotificationsPermission) {
        console.log("User declined initial notifications permission request");
      }

      if (!grantedLocationPermission) {
        console.log("User declined initial location permission request");
      }

      // Mark first run as complete
      appStore.setIsFirstRun(false);
    }
  } catch (error) {
    console.error("First run setup failed:", error);
    Sentry.captureException(error);
  }
};
