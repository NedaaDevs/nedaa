import { Platform } from "react-native";

import { PlatformType } from "@/enums/app";

import {
  getPlacedWidgetCount as iosPlacedCount,
  getWidgetLastRenderedAt as iosLastRendered,
  isWidgetReloadAvailable,
  reloadAllWidgets,
} from "../../modules/expo-widget/src";
import {
  getPlacedWidgetCount as androidPlacedCount,
  getWidgetLastRenderedAt as androidLastRendered,
  isWidgetsModuleAvailable,
  refreshAllWidgets,
} from "../../modules/expo-widgets/src";

const isIOS = Platform.OS === PlatformType.IOS;

// Both modules degrade to no-ops when absent, and a no-op must surface as a failure
// rather than as a zero placed count.
export const isWidgetRefreshAvailable = (): boolean =>
  isIOS ? isWidgetReloadAvailable() : isWidgetsModuleAvailable();

export const getPlacedWidgetCount = async (): Promise<number> =>
  isIOS ? iosPlacedCount() : androidPlacedCount();

export const getWidgetLastRenderedAt = (): number =>
  isIOS ? iosLastRendered() : androidLastRendered();

export const triggerWidgetReload = async (): Promise<void> => {
  reloadAllWidgets();
  await refreshAllWidgets();
};
