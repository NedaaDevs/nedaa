import { requireOptionalNativeModule, Platform } from "expo-modules-core";

const NativeModule = requireOptionalNativeModule("ExpoWidgets");

export type WidgetType =
  | "prayer_small"
  | "prayer_medium"
  | "prayer_large"
  | "athkar"
  | "athkar_medium"
  | "qada"
  | "qada_medium"
  | "prayer_athkar"
  | "important_days";

export function isPinningSupported(): boolean {
  if (Platform.OS !== "android" || !NativeModule) return false;
  return NativeModule.isPinningSupported();
}

export function getAvailableWidgets(): WidgetType[] {
  if (Platform.OS !== "android" || !NativeModule) return [];
  return NativeModule.getAvailableWidgets();
}

export async function pinWidget(widgetType: WidgetType): Promise<boolean> {
  if (Platform.OS !== "android" || !NativeModule) return false;
  return NativeModule.pinWidget(widgetType);
}

// Re-render all placed Android widgets now; call after widget-relevant data writes.
export async function refreshAllWidgets(): Promise<void> {
  if (Platform.OS !== "android" || !NativeModule) return;
  return NativeModule.refreshAllWidgets();
}

export function isBatteryOptimizationDisabled(): boolean {
  if (Platform.OS !== "android" || !NativeModule) return true;
  return NativeModule.isBatteryOptimizationDisabled();
}

export function requestDisableBatteryOptimization(): boolean {
  if (Platform.OS !== "android" || !NativeModule) return false;
  return NativeModule.requestDisableBatteryOptimization();
}
