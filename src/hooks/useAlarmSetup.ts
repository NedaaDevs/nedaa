import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

// Services
import { alarmScheduler } from "@/services/alarm/alarmScheduler";

// Stores
import { useAlarmStore } from "@/stores/alarm";

/**
 * Hook to initialize and manage alarm scheduling.
 *
 * Note: Alarm UI (ringing, snooze, dismiss, challenges) is handled natively:
 * - Android: AlarmActivity with native overlay
 * - iOS: AlarmKit system UI
 *
 * This hook handles:
 * - Initializing the alarm scheduler
 * - Rescheduling alarms when app comes to foreground
 */
export function useAlarmSetup() {
  const initRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const rescheduleIfNeeded = useAlarmStore((state) => state.rescheduleIfNeeded);

  // ==========================================
  // INITIALIZATION
  // ==========================================

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initialize = async () => {
      console.log("[useAlarmSetup] Initializing alarm system...");

      // Initialize platform-specific alarm services
      const initialized = await alarmScheduler.initialize();
      console.log("[useAlarmSetup] Scheduler initialized:", initialized);
    };

    initialize();
  }, []);

  // ==========================================
  // APP STATE HANDLING
  // ==========================================

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // When app comes to foreground, check if we need to reschedule
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        console.log("[useAlarmSetup] App became active, checking alarms...");
        rescheduleIfNeeded(false);
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [rescheduleIfNeeded]);
}
