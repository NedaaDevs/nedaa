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
  | "important_days"
  | "all_prayers"
  | "suhoor_iftar"
  | "hijri_date";

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

// False when the native module is absent (stale dev client or bad build), in which
// case every call below is a silent no-op.
export const isWidgetsModuleAvailable = (): boolean => NativeModule != null;

// 0 when no widget has rendered yet.
export const getWidgetLastRenderedAt = (): number => {
  if (Platform.OS !== "android" || !NativeModule) return 0;
  return NativeModule.getWidgetLastRenderedAt();
};

export const getPlacedWidgetCount = (): number => {
  if (Platform.OS !== "android" || !NativeModule) return 0;
  return NativeModule.getPlacedWidgetCount();
};

export function isBatteryOptimizationDisabled(): boolean {
  if (Platform.OS !== "android" || !NativeModule) return true;
  return NativeModule.isBatteryOptimizationDisabled();
}

export function requestDisableBatteryOptimization(): boolean {
  if (Platform.OS !== "android" || !NativeModule) return false;
  return NativeModule.requestDisableBatteryOptimization();
}
