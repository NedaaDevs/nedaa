import { useEffect, useRef } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import { useAlarmStore } from "@/stores/alarm";

// Simple in-memory Set to prevent duplicate processing
const handledAlarmIds = new Set<string>();

/**
 * Mark an alarm as handled (call this after challenge is done)
 */
export function markAlarmHandled(alarmId: string) {
  console.log(`[Alarm] Marked handled: ${alarmId}`);
  handledAlarmIds.add(alarmId);
}

/**
 * Check if an alarm has been handled
 */
export function isAlarmHandled(alarmId: string): boolean {
  return handledAlarmIds.has(alarmId);
}

/**
 * Hook to handle alarm deep links and check for firing alarms
 * Listens for URLs like: dev.nedaa.app://alarm?alarmId=xxx&alarmType=fajr
 */
export function useAlarmDeepLink() {
  const { scheduledAlarms } = useAlarmStore();
  const initialUrlProcessed = useRef(false);

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      processAlarmUrl(event.url);
    };

    // Check initial URL only once
    if (!initialUrlProcessed.current) {
      initialUrlProcessed.current = true;
      Linking.getInitialURL().then((url) => {
        if (url) {
          processAlarmUrl(url);
        } else {
          checkForFiringAlarms(scheduledAlarms);
        }
      });
    }

    const subscription = Linking.addEventListener("url", handleUrl);
    return () => subscription.remove();
  }, [scheduledAlarms]);
}

/**
 * Check if there are any alarms that should have fired
 */
function checkForFiringAlarms(
  scheduledAlarms: Record<string, { alarmId: string; alarmType: string; triggerTime: number }>
) {
  const now = Date.now();

  for (const alarm of Object.values(scheduledAlarms)) {
    if (alarm.triggerTime <= now && !handledAlarmIds.has(alarm.alarmId)) {
      console.log(`[Alarm] Found past-due alarm: ${alarm.alarmId}`);
      router.push({
        pathname: "/alarm",
        params: { alarmId: alarm.alarmId, alarmType: alarm.alarmType },
      });
      return;
    }
  }
}

function processAlarmUrl(url: string) {
  try {
    if (!url.includes("alarm")) return;

    const urlObj = new URL(url);
    const alarmId = urlObj.searchParams.get("alarmId");
    const alarmType = urlObj.searchParams.get("alarmType");

    if (alarmId) {
      if (handledAlarmIds.has(alarmId)) {
        console.log(`[Alarm] Deep link ignored (already handled): ${alarmId}`);
        return;
      }

      console.log(`[Alarm] Deep link received: ${alarmId} (${alarmType ?? "unknown"})`);
      router.push({
        pathname: "/alarm",
        params: { alarmId, ...(alarmType && { alarmType }) },
      });
    }
  } catch (e) {
    console.warn(`[Alarm] Invalid URL: ${url}`);
  }
}
