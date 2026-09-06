import { Platform } from "react-native";

import { PlatformType } from "@/enums/app";
import { AppLogger } from "@/utils/appLogger";

import {
  getPlacedWidgetCount,
  isPersistentNotificationEnabled,
} from "../../modules/expo-widgets/src";

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

// Both values describe Android-only components.
export const logLaunchWidgetAttachContext = (): void => {
  if (Platform.OS !== PlatformType.ANDROID) return;
  logWidgetAttachContext({ getPlacedWidgetCount, isPersistentNotificationEnabled });
};
