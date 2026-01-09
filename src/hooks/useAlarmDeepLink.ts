import { useEffect } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";

/**
 * Hook to handle alarm deep links
 * Listens for URLs like: dev.nedaa.app://alarm/{alarmType}/{alarmId}
 */
export function useAlarmDeepLink() {
  useEffect(() => {
    // Handle URL when app is opened from deep link
    const handleUrl = (event: { url: string }) => {
      processAlarmUrl(event.url);
    };

    // Check if app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        processAlarmUrl(url);
      }
    });

    // Listen for URL events while app is running
    const subscription = Linking.addEventListener("url", handleUrl);

    return () => {
      subscription.remove();
    };
  }, []);
}

function processAlarmUrl(url: string) {
  // Parse URL: dev.nedaa.app://alarm?id=xxx&type=fajr
  try {
    // Check if this is an alarm URL
    if (!url.includes("alarm")) return;

    // Parse query params
    const urlObj = new URL(url);
    const alarmId = urlObj.searchParams.get("alarmId");
    const alarmType = urlObj.searchParams.get("alarmType");

    if (alarmId) {
      console.log(`[Alarm Deep Link] ID: ${alarmId}, Type: ${alarmType ?? "unknown"}`);

      // Navigate to alarm screen
      router.push({
        pathname: "/alarm",
        params: { alarmId, ...(alarmType && { alarmType }) },
      });
    }
  } catch (error) {
    console.error("[Alarm Deep Link] Error processing URL:", error);
  }
}
