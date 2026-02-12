import { requireOptionalNativeModule, Platform } from "expo-modules-core";

const NativeModule = requireOptionalNativeModule("ExpoWidgets");

export type WidgetType =
  | "prayer_small"
  | "prayer_medium"
  | "prayer_large"
  | "athkar"
  | "qada"
  | "prayer_athkar";

export function isPinningSupported(): boolean {
  if (Platform.OS !== "android" || !NativeModule) return false;
  return NativeModule.isPinningSupported();
}

export function getAvailableWidgets(): WidgetType[] {
  if (Platform.OS !== "android" || !NativeModule) return [];
  return NativeModule.getAvailableWidgets();
}

export function pinWidget(widgetType: WidgetType): boolean {
  if (Platform.OS !== "android" || !NativeModule) return false;
  return NativeModule.pinWidget(widgetType);
}
