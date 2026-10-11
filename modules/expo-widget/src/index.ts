import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

let ExpoWidget: any = null;
let loadError: Error | null = null;
if (Platform.OS === "ios") {
  try {
    ExpoWidget = requireNativeModule("ExpoWidget");
  } catch (error) {
    loadError = error instanceof Error ? error : new Error(String(error));
  }
}

// The app logs this; a local module cannot import app code.
export const getWidgetModuleLoadError = (): Error | null => loadError;

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

// 0 when the module is absent or no widget has rendered yet.
export const getWidgetLastRenderedAt = (): number => ExpoWidget?.getWidgetLastRenderedAt() ?? 0;

export const getPlacedWidgetCount = async (): Promise<number> => {
  if (ExpoWidget == null) return 0;
  return ExpoWidget.getPlacedWidgetCount();
};
