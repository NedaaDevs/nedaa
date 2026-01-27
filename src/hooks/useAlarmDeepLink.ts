import { useEffect, useRef } from "react";
import { Linking, AppState } from "react-native";
import { router } from "expo-router";
import { useAlarmStore } from "@/stores/alarm";
import { detectActiveAlarm } from "@/utils/activeAlarmDetector";

const handledAlarmIds = new Set<string>();

const navGuard = {
  activeAlarmId: null as string | null,
  lastNavTime: 0,
};

const NAVIGATION_DEBOUNCE_MS = 5000;

export function setAlarmScreenActive(alarmId: string | null) {
  navGuard.activeAlarmId = alarmId;
  if (alarmId) {
    navGuard.lastNavTime = Date.now();
  }
}

export function markAlarmHandled(alarmId: string) {
  handledAlarmIds.add(alarmId);
}

export function isAlarmHandled(alarmId: string): boolean {
  return handledAlarmIds.has(alarmId);
}

export function navigateToAlarm(alarmId: string, alarmType: string, _source: string) {
  const now = Date.now();

  if (navGuard.activeAlarmId) return false;
  if (now - navGuard.lastNavTime < NAVIGATION_DEBOUNCE_MS) return false;
  if (handledAlarmIds.has(alarmId)) return false;

  navGuard.activeAlarmId = alarmId;
  navGuard.lastNavTime = now;

  router.replace({
    pathname: "/alarm",
    params: { alarmId, alarmType },
  });

  return true;
}

export function useAlarmDeepLink() {
  const { scheduledAlarms } = useAlarmStore();
  const initialUrlProcessed = useRef(false);

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      processAlarmUrl(event.url);
    };

    if (!initialUrlProcessed.current) {
      initialUrlProcessed.current = true;
      Linking.getInitialURL().then((url) => {
        if (url) {
          processAlarmUrl(url);
        } else {
          detectActiveAlarm(scheduledAlarms).then((active) => {
            if (active) {
              navigateToAlarm(active.alarmId, active.alarmType, active.source);
            }
          });
        }
      });
    }

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        detectActiveAlarm(scheduledAlarms).then((active) => {
          if (active) {
            navigateToAlarm(active.alarmId, active.alarmType, active.source);
          }
        });
      }
    });

    const subscription = Linking.addEventListener("url", handleUrl);
    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, [scheduledAlarms]);
}

function processAlarmUrl(url: string) {
  try {
    if (!url.includes("alarm")) return;

    const urlObj = new URL(url);
    const alarmId = urlObj.searchParams.get("alarmId");
    const alarmType = urlObj.searchParams.get("alarmType") ?? "custom";

    if (alarmId) {
      navigateToAlarm(alarmId, alarmType, "deep-link");
    }
  } catch {
    // invalid URL
  }
}
