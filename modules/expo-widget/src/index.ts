import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

const ExpoWidget = Platform.OS === "ios" ? requireNativeModule("ExpoWidget") : null;

export function reloadPrayerWidgets(): void {
  ExpoWidget?.reloadPrayerWidgets();
}

export function reloadAllWidgets(): void {
  ExpoWidget?.reloadAllWidgets();
}
