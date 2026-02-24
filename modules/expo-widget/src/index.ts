import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

let ExpoWidget: any = null;
if (Platform.OS === "ios") {
  try {
    ExpoWidget = requireNativeModule("ExpoWidget");
  } catch {
    // Module not available — native rebuild required
  }
}

export function reloadPrayerWidgets(): void {
  ExpoWidget?.reloadPrayerWidgets();
}

export function reloadAllWidgets(): void {
  ExpoWidget?.reloadAllWidgets();
}
