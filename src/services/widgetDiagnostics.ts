import { Platform } from "react-native";

import { PlatformType } from "@/enums/app";
import { AppLogger } from "@/utils/appLogger";

import { getWidgetModuleLoadError } from "expo-widget";
import { getPlacedWidgetCount, isPersistentNotificationEnabled } from "expo-widgets";

const log = AppLogger.create("widgets");

export type WidgetAttachContextDeps = {
  getPlacedWidgetCount: () => number;
  isPersistentNotificationEnabled: () => boolean;
};

/**
 * Records which components could open the widget databases this launch.
 *
 * A placed widget and the shade card each open `nedaa.db` with the system SQLite in
 * the app process, alongside expo-sqlite. A native crash report carries the fault but
 * neither of these values, and the rest of this domain logs only on failure, so an
 * absent section cannot be read as "nothing was placed".
 */
export const logWidgetAttachContext = (deps: WidgetAttachContextDeps): void => {
  let placed: number;
  let persistent: boolean;
  try {
    placed = deps.getPlacedWidgetCount();
    persistent = deps.isPersistentNotificationEnabled();
  } catch (error) {
    // Unknown is not zero — a missing native module must not read as an empty home screen.
    log.w("AttachContext", `widget attach context unreadable: ${String(error)}`);
    return;
  }

  log.i(
    "AttachContext",
    `placedWidgets=${placed} persistentNotification=${persistent ? "on" : "off"}`
  );
};

// A missing module turns every reload into a no-op, so its load error is logged.
export const logWidgetReloadModule = (loadError: Error | null): void => {
  if (!loadError) return;
  log.e("Module", "expo-widget native module missing — widget reloads are no-ops", loadError);
};

export const logLaunchWidgetAttachContext = (): void => {
  if (Platform.OS === PlatformType.IOS) {
    logWidgetReloadModule(getWidgetModuleLoadError());
    return;
  }
  // Both values describe Android-only components.
  logWidgetAttachContext({ getPlacedWidgetCount, isPersistentNotificationEnabled });
};
