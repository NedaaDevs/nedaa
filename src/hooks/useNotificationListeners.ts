import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

// Constants
import { APP_STATE } from "@/constants/AppState";

// Services
import { cleanupManager } from "@/services/cleanup";

// Utils
import { configureNotifications } from "@/utils/notifications";

/**
 * Hook to properly manage notification listeners with cleanup
 */
export const useNotificationListeners = () => {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Configure notifications (this also registers cleanup with cleanup manager)
    configureNotifications();

    // Handle app state changes for better resource management
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousState = appState.current;

      const wasAway =
        previousState === APP_STATE.INACTIVE || previousState === APP_STATE.BACKGROUND;
      if (wasAway && nextAppState === APP_STATE.ACTIVE) {
        console.log("[Notifications] App has come to the foreground");
      } else if (nextAppState === APP_STATE.BACKGROUND) {
        console.log("[Notifications] App is going to background");
        await cleanupManager.executeAll("app-background");
      } else if (nextAppState === APP_STATE.INACTIVE) {
        // App is becoming inactive (user switching apps, receiving call, etc.)
        console.log("[Notifications] App is becoming inactive");
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  // Return cleanup manager methods for external use if needed
  return {
    executeCleanup: (reason?: string) => cleanupManager.executeAll(reason),
    getRegisteredTasks: () => cleanupManager.getRegisteredTasks(),
    isCleanupInProgress: () => cleanupManager.isCleanupInProgress(),
  };
};

export default useNotificationListeners;
