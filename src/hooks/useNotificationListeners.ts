import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

// Services
import { appCleanup } from "@/services/setup";
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

      if (previousState.match(/inactive|background/) && nextAppState === "active") {
        // App has come to the foreground
        console.log("[Notifications] App has come to the foreground");
        // Could re-setup listeners here if needed
      } else if (nextAppState === "background") {
        // App is going to background
        console.log("[Notifications] App is going to background");
        // Execute cleanup when app goes to background
        await cleanupManager.executeAll("app-background");
      } else if (nextAppState === "inactive") {
        // App is becoming inactive (user switching apps, receiving call, etc.)
        console.log("[Notifications] App is becoming inactive");
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    // Cleanup on unmount using cleanup manager
    return () => {
      subscription?.remove();
      // Use cleanup manager for coordinated cleanup
      appCleanup("component-unmount");
    };
  }, []);

  // Return cleanup manager methods for external use if needed
  return {
    executeCleanup: (reason?: string) => cleanupManager.executeAll(reason),
    getRegisteredTasks: () => cleanupManager.getRegisteredTasks(),
    isCleanupInProgress: () => cleanupManager.isCleanupInProgress(),
  };
};

export { appCleanup };
export default useNotificationListeners;
