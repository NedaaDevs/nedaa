import type * as Notifications from "expo-notifications";
import { router, type Href } from "expo-router";
import { stopAthan } from "expo-alarm";
import { Platform } from "react-native";

import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { PlatformType } from "@/enums/app";

// A launch tap arrives twice: as the stored last response and on the listener.
let lastHandled: string | null = null;

/** Acts on a tapped notification: silences the athan, then opens its screen. */
export const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
  const { identifier, content } = response.notification.request;
  if (identifier === lastHandled) return;
  lastHandled = identifier;
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
      void link.openQuranReminderTarget({ surah: data.surah as number | undefined });
    }
  } catch (error) {
    console.error("[Notifications] Error handling notification response:", error);
  }
};
