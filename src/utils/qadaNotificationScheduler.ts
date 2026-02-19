import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

// Utils
import { scheduleNotification, scheduleRecurringNotification } from "@/utils/notifications";
import { createChannelWithCustomSound } from "@/utils/customSoundManager";
import { timeZonedNow, HijriNative } from "@/utils/date";
import locationStore from "@/stores/location";

// Types
import type { QadaSettings } from "@/services/qada-db";
import type { CustomSound } from "@/types/customSound";
import type { NotificationSettings } from "@/types/notification";

// Enums
import { PlatformType } from "@/enums/app";

/**
 * Calculate next Ramadan date using Hijri calendar with timezone awareness
 */
export const calculateNextRamadan = (): Date => {
  // Get current timezone from location store
  const timezone = locationStore.getState().locationDetails.timezone;
  const today = timeZonedNow(timezone);

  const currentHijri = HijriNative.today(timezone);

  const toDate = (g: { year: number; month: number; day: number }) =>
    new Date(g.year, g.month - 1, g.day);

  // Check if we've passed Ramadan this year (inclusive - if today is Ramadan, return it)
  const currentYearRamadan = toDate(HijriNative.toGregorian(currentHijri.year, 9, 1)); // 1 Ramadan

  let nextRamadan: Date;
  let hijriYear: number;

  if (currentYearRamadan >= today) {
    nextRamadan = currentYearRamadan; // Ramadan is today or coming up this year
    hijriYear = currentHijri.year;
  } else {
    // Ramadan has passed this year, use next year
    hijriYear = currentHijri.year + 1;
    nextRamadan = toDate(HijriNative.toGregorian(hijriYear, 9, 1)); // 1 Ramadan next year
  }

  console.log(
    `[Qada Notification] Next Ramadan: ${format(nextRamadan, "PPP")} (1 Ramadan ${hijriYear} AH)`
  );

  return nextRamadan;
};

/**
 * Calculate days until Ramadan from a given date
 */
export const calculateDaysUntilRamadan = (fromDate: Date, ramadanDate: Date): number => {
  const diffTime = ramadanDate.getTime() - fromDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

/**
 * Build notification content respecting privacy mode
 */
export const buildNotificationContent = (
  remainingCount: number,
  privacyMode: boolean,
  t: (key: string, options?: any) => string,
  type: "ramadan" | "custom",
  daysUntilRamadan?: number
): { title: string; body: string } => {
  if (privacyMode) {
    // Use generic app name for privacy
    if (type === "ramadan") {
      return {
        title: t("common.nedaa"),
        body: t("notification.qada.bodyPrivacyRamadan"),
      };
    }
    return {
      title: t("common.nedaa"),
      body: t("notification.qada.bodyPrivacy"),
    };
  }

  if (type === "ramadan" && daysUntilRamadan) {
    return {
      title: t("notification.qada.titleRamadan"),
      body: t("notification.qada.bodyRamadan", {
        days: daysUntilRamadan,
        count: remainingCount,
      }),
    };
  }

  return {
    title: t("notification.qada.title"),
    body: t("notification.qada.bodyWithCount", { count: remainingCount }),
  };
};

/**
 * Setup Android notification channel for qada using centralized custom sound manager
 */
export const setupQadaNotificationChannel = async (
  soundKey: string,
  customSounds: CustomSound[],
  vibrationEnabled: boolean
): Promise<string> => {
  const channelId = `qada_reminder_${soundKey}_${vibrationEnabled ? "vib" : "silent"}`;

  if (Platform.OS !== PlatformType.ANDROID) {
    return channelId;
  }

  try {
    // Use the centralized createChannelWithCustomSound function
    // This handles both custom and bundled sounds automatically
    await createChannelWithCustomSound(
      channelId,
      "Qada Reminders",
      soundKey,
      customSounds,
      Notifications.AndroidImportance.HIGH,
      vibrationEnabled
    );

    console.log(
      `[Qada Notification] Created channel: ${channelId} with sound: ${soundKey}, vibration: ${vibrationEnabled}`
    );
    return channelId;
  } catch (error) {
    console.error(`[Qada Notification] Failed to create channel ${channelId}:`, error);

    // Fallback to system default channel
    const fallbackChannelId = "qada_reminder_default";
    await Notifications.setNotificationChannelAsync(fallbackChannelId, {
      name: "Qada Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: vibrationEnabled ? [0, 500, 200, 500] : undefined,
      enableVibrate: vibrationEnabled,
    });

    return fallbackChannelId;
  }
};

/**
 * Cancel all qada notifications
 */
export const cancelAllQadaNotifications = async (): Promise<void> => {
  try {
    // Cancel all scheduled notifications with qada category
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

    const qadaNotifications = scheduledNotifications.filter(
      (notification) => notification.content.data?.type === "QADA_REMINDER"
    );

    for (const notification of qadaNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }

    console.log(`[Qada Notification] Cancelled ${qadaNotifications.length} notifications`);
  } catch (error) {
    console.error("[Qada Notification] Error cancelling notifications:", error);
  }
};

/**
 * Get qada notification sound settings
 */
export const getQadaSoundSettings = (
  notificationSettings: NotificationSettings
): {
  enabled: boolean;
  sound: string;
  vibration: boolean;
} => {
  const qadaConfig = notificationSettings.defaults.qada;
  return {
    enabled: qadaConfig.enabled,
    sound: qadaConfig.sound,
    vibration: qadaConfig.vibration,
  };
};

/**
 * Main scheduler for qada notifications
 * Handles all 3 reminder types (none, ramadan, custom)
 * Smart Ramadan tracking: if scheduled date passed but Ramadan is coming, still sends notification
 */
export const scheduleQadaNotifications = async (
  settings: QadaSettings,
  remainingCount: number,
  t: (key: string, options?: any) => string,
  notificationSettings: NotificationSettings,
  customSounds: CustomSound[] = []
): Promise<void> => {
  try {
    // Check if qada notifications are enabled in notification settings
    const qadaSoundSettings = getQadaSoundSettings(notificationSettings);

    if (!qadaSoundSettings.enabled || settings.reminder_type === "none" || remainingCount <= 0) {
      await cancelAllQadaNotifications();
      return;
    }

    // Cancel existing notifications first (replacement pattern)
    await cancelAllQadaNotifications();

    // Get current timezone-aware date
    const timezone = locationStore.getState().locationDetails.timezone;
    const now = timeZonedNow(timezone);

    let notificationDate: Date | null = null;
    let notificationType: "ramadan" | "custom" = "custom";
    let daysUntilRamadan: number | undefined;

    // Determine the start date for daily reminders
    let startDate: Date | null = null;
    let useRecurring = false;

    if (settings.reminder_type === "ramadan" && settings.reminder_days) {
      const nextRamadan = calculateNextRamadan();

      // Convert to timezone-aware date and calculate start date
      // Start reminding X days before Ramadan at 10 AM
      startDate = toZonedTime(nextRamadan, timezone);
      startDate.setDate(startDate.getDate() - settings.reminder_days);
      startDate.setHours(10, 0, 0, 0);

      // Convert nextRamadan to timezone-aware for comparison
      const nextRamadanZoned = toZonedTime(nextRamadan, timezone);

      // Check if we should use recurring notifications
      if (startDate <= now && nextRamadanZoned > now) {
        // Start date has passed, use daily recurring reminders
        useRecurring = true;
        notificationType = "ramadan";

        // Calculate actual days until Ramadan for notification content
        daysUntilRamadan = calculateDaysUntilRamadan(now, nextRamadanZoned);
        console.log(
          `[Qada Notification] Start date passed, scheduling daily reminders (Ramadan in ${daysUntilRamadan} days)`
        );
      } else if (startDate > now) {
        // Start date is in the future, schedule one-time for that date
        notificationDate = startDate;
        daysUntilRamadan = settings.reminder_days;
        notificationType = "ramadan";
        console.log(
          `[Qada Notification] Scheduling one-time reminder for start date: ${format(startDate, "PPP")}`
        );
      } else {
        // Ramadan has passed, will schedule for next year
        console.log("[Qada Notification] Ramadan has passed for this year");
        return;
      }
    } else if (settings.reminder_type === "custom" && settings.custom_date) {
      // Parse custom date in user's timezone and set to 10 AM
      const customDate = new Date(settings.custom_date);
      startDate = toZonedTime(customDate, timezone);
      startDate.setHours(10, 0, 0, 0);
      notificationType = "custom";

      // Check if we should use recurring notifications
      if (startDate <= now) {
        // Start date has passed, use daily recurring reminders
        useRecurring = true;
        console.log(`[Qada Notification] Custom start date passed, scheduling daily reminders`);
      } else {
        // Start date is in the future, schedule one-time for that date
        notificationDate = startDate;
        console.log(
          `[Qada Notification] Scheduling one-time reminder for custom start date: ${format(startDate, "PPP")}`
        );
      }
    }

    // Validate: must have either a notification date (one-time) or useRecurring flag
    if (!notificationDate && !useRecurring) {
      console.log("[Qada Notification] Invalid notification configuration");
      return;
    }

    // Handle "default" sound - don't pass to channel creation
    let soundKey = qadaSoundSettings.sound;
    let channelId: string;

    if (soundKey === "default") {
      // For default system sound, use a simple channel without custom sound
      channelId = "qada_reminder_default";
      if (Platform.OS === PlatformType.ANDROID) {
        await Notifications.setNotificationChannelAsync(channelId, {
          name: "Qada Reminders",
          importance: Notifications.AndroidImportance.HIGH,
          sound: "default",
          vibrationPattern: qadaSoundSettings.vibration ? [0, 500, 200, 500] : undefined,
          enableVibrate: qadaSoundSettings.vibration,
        });
      }
    } else {
      // For custom/bundled sounds, use the channel setup function
      channelId = await setupQadaNotificationChannel(
        soundKey,
        customSounds,
        qadaSoundSettings.vibration
      );
    }

    // Build notification content
    const content = buildNotificationContent(
      remainingCount,
      settings.privacy_mode === 1,
      t,
      notificationType,
      daysUntilRamadan
    );

    // For iOS, custom sounds aren't supported, always use system default
    const finalSoundKey = Platform.OS === PlatformType.IOS ? "default" : soundKey;

    // Schedule notification (either one-time or recurring daily)
    let result: { success: boolean; id?: string; message?: string };

    if (useRecurring) {
      // Schedule daily recurring notification at 10 AM
      result = await scheduleRecurringNotification(
        10, // hour
        0, // minute
        {
          title: content.title,
          body: content.body,
          sound: finalSoundKey,
          data: {
            type: "QADA_REMINDER",
            screen: "/(tabs)/qada",
            notificationType: notificationType,
          },
        },
        {
          vibrate: qadaSoundSettings.vibration,
          channelId,
          timezone,
        }
      );

      if (result.success) {
        console.log(
          `[Qada Notification] Scheduled daily recurring ${notificationType} reminders at 10:00 AM`
        );
      } else {
        console.error(`[Qada Notification] Failed to schedule recurring: ${result.message}`);
      }
    } else if (notificationDate) {
      // Schedule one-time notification for the start date
      result = await scheduleNotification(
        notificationDate,
        {
          title: content.title,
          body: content.body,
          sound: finalSoundKey,
          data: {
            type: "QADA_REMINDER",
            screen: "/(tabs)/qada",
            notificationType: notificationType,
          },
        },
        {
          vibrate: qadaSoundSettings.vibration,
          channelId,
        }
      );

      if (result.success) {
        console.log(
          `[Qada Notification] Scheduled one-time ${notificationType} reminder for ${format(notificationDate, "PPP")}`
        );
      } else {
        console.error(`[Qada Notification] Failed to schedule: ${result.message}`);
      }
    }
  } catch (error) {
    console.error("[Qada Notification] Error scheduling notifications:", error);
  }
};
