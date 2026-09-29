import type * as Notifications from "expo-notifications";
import { router, type Href } from "expo-router";
import { stopAthan } from "expo-alarm";
import { Platform } from "react-native";

import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { PlatformType } from "@/enums/app";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("notifications");

// A launch tap arrives twice: as the stored last response and on the listener.
let lastHandled: string | null = null;

/** Acts on a tapped notification: silences the athan, then opens its screen. */
export const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
  const { date, request } = response.notification;
  const { identifier, content } = request;
  // A repeating reminder reuses its request id, so the date marks the delivery.
  const delivery = `${identifier}@${date}`;
  if (delivery === lastHandled) return;
  lastHandled = delivery;
  const { data } = content;

  try {
    if (Platform.OS === PlatformType.ANDROID && data?.type === NOTIFICATION_TYPE.PRAYER) {
      stopAthan();
    }
    if (typeof data?.screen === "string") router.navigate(data.screen as Href);

    if (data?.type === NOTIFICATION_TYPE.QURAN_REMINDER) {
      // Required on tap so the reader and content DB stay out of startup.
      type DeepLink = typeof import("@/utils/notificationDeepLink");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const link: DeepLink = require("@/utils/notificationDeepLink");
      const surah = typeof data.surah === "number" ? data.surah : undefined;
      void link.openQuranReminderTarget({ surah });
    }
  } catch (error) {
    log.e("Tap", `failed to open ${identifier}`, error instanceof Error ? error : undefined);
  }
};
