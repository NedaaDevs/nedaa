import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("widgets");

let ExpoWidget: any = null;
if (Platform.OS === "ios") {
  try {
    ExpoWidget = requireNativeModule("ExpoWidget");
  } catch (error) {
    // A missing module makes every reload a no-op, so widgets go stale after data
    // changes with nothing visible in the app to explain it.
    log.e(
      "Module",
      "expo-widget native module missing — widget reloads are no-ops",
      error as Error
    );
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

// 0 when the module is absent or no widget has rendered yet.
export const getWidgetLastRenderedAt = (): number => ExpoWidget?.getWidgetLastRenderedAt() ?? 0;

export const getPlacedWidgetCount = async (): Promise<number> => {
  if (ExpoWidget == null) return 0;
  return ExpoWidget.getPlacedWidgetCount();
};
