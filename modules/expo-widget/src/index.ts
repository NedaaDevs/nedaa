import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

let ExpoWidget: any = null;
if (Platform.OS === "ios") {
  try {
    ExpoWidget = requireNativeModule("ExpoWidget");
  } catch {
    // Module not available (native rebuild required). Loud, not silent — a no-op
    // here means widget timelines never refresh after data updates.
    console.warn("[expo-widget] native module missing — widget reloads are no-ops");
  }
}

// Whether the native reload module is present (false → reloads are no-ops).
export function isWidgetReloadAvailable(): boolean {
  return ExpoWidget != null;
}

export function reloadPrayerWidgets(): void {
  ExpoWidget?.reloadPrayerWidgets();
}

export function reloadAllWidgets(): void {
  ExpoWidget?.reloadAllWidgets();
}
