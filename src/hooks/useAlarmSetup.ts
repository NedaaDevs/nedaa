import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

// Services
import { alarmScheduler } from "@/services/alarm/alarmScheduler";

// Stores
import { useAlarmStore } from "@/stores/alarm";

// ==========================================
// ALARM SETUP HOOK
// ==========================================

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
 * - Rescheduling when settings change
 */
export function useAlarmSetup() {
  const initRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // Store actions
  const rescheduleIfNeeded = useAlarmStore((state) => state.rescheduleIfNeeded);
  const fajrAlarm = useAlarmStore((state) => state.fajrAlarm);
  const jummahAlarm = useAlarmStore((state) => state.jummahAlarm);

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

  // ==========================================
  // SCHEDULE ON SETTINGS CHANGE
  // ==========================================

  // Track previous values to detect actual changes
  const prevSettingsRef = useRef<string | null>(null);

  // Reschedule when alarm settings change
  useEffect(() => {
    // Don't schedule on initial mount (will be handled by initialize)
    if (!initRef.current) return;

    // Create a settings key to detect actual changes
    const settingsKey = JSON.stringify({
      fajrEnabled: fajrAlarm.enabled,
      fajrTimeMode: fajrAlarm.timeMode,
      fajrOffset: fajrAlarm.offsetMinutes,
      fajrHour: fajrAlarm.fixedHour,
      fajrMinute: fajrAlarm.fixedMinute,
      jummahEnabled: jummahAlarm.enabled,
      jummahTimeMode: jummahAlarm.timeMode,
      jummahOffset: jummahAlarm.offsetMinutes,
      jummahHour: jummahAlarm.fixedHour,
      jummahMinute: jummahAlarm.fixedMinute,
    });

    // Skip if settings haven't actually changed
    if (prevSettingsRef.current === settingsKey) {
      return;
    }
    prevSettingsRef.current = settingsKey;

    const anyEnabled = fajrAlarm.enabled || jummahAlarm.enabled;
    if (anyEnabled) {
      rescheduleIfNeeded(true);
    }
  }, [
    fajrAlarm.enabled,
    jummahAlarm.enabled,
    fajrAlarm.timeMode,
    fajrAlarm.offsetMinutes,
    fajrAlarm.fixedHour,
    fajrAlarm.fixedMinute,
    jummahAlarm.timeMode,
    jummahAlarm.offsetMinutes,
    jummahAlarm.fixedHour,
    jummahAlarm.fixedMinute,
    rescheduleIfNeeded,
  ]);
}
