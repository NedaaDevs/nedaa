import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

// Services
import { appCleanup } from "@/services/setup";

// Utils
import { configureNotifications, cleanupNotificationListeners } from "@/utils/notifications";

/**
 * Hook to properly manage notification listeners with cleanup
 */
export const useNotificationListeners = () => {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    configureNotifications();

    // Handle app state changes for better resource management
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        // App has come to the foreground - listeners should already be active
        console.log("[Notifications] App has come to the foreground");
      } else if (nextAppState === "background") {
        // App is going to background - keep listeners active for background notifications
        console.log("[Notifications] App is going to background");
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    // Cleanup on unmount using service layer
    return () => {
      subscription?.remove();
      // Use service layer cleanup which handles all cleanup logic
      appCleanup();
    };
  }, []);
};

export { cleanupNotificationListeners, appCleanup };

export default useNotificationListeners;
