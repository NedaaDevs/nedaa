import * as Notifications from "expo-notifications";
import {
  PermissionStatus,
  NotificationContentInput,
  AndroidNotificationPriority,
} from "expo-notifications";
import { Platform } from "react-native";

// Services
import { cleanupManager } from "@/services/cleanup";

// Enums
import { PlatformType } from "@/enums/app";

// Types
import type { NotificationOptions } from "@/types/notification";

// Both schedulers send the same content; only their triggers differ.
const buildContent = (
  notificationInput: NotificationContentInput,
  options?: NotificationOptions
): NotificationContentInput => {
  // The sound stays in the content: iOS and Android before 8.0 play it there.
  const content: NotificationContentInput = {
    ...notificationInput,
    data: {
      ...notificationInput.data,
      categoryId: options?.categoryId,
    },
  };

  if (Platform.OS === PlatformType.ANDROID) {
    content.priority = AndroidNotificationPriority.HIGH;

    if (options?.vibrate !== undefined) {
      content.vibrate = options.vibrate ? [0, 500, 200, 500] : [];
    }
  } else if (Platform.OS === PlatformType.IOS) {
    if (options?.timeSensitive) {
      content.interruptionLevel = "timeSensitive";
    }
  }

  return content;
};

// Android 8.0+ posts on the caller's channel; iOS has no channels.
const androidChannel = (options?: NotificationOptions): string | undefined =>
  Platform.OS === PlatformType.ANDROID ? options?.channelId : undefined;

export const scheduleNotification = async (
  date: Date,
  notificationInput: NotificationContentInput,
  options?: NotificationOptions & { timezone?: string }
) => {
  const { status } = await checkPermissions();

  if (status !== PermissionStatus.GRANTED) {
    return { success: false, message: "Notifications permission not granted" };
  }

  try {
    const content = buildContent(notificationInput, options);

    // trigger type
    let trigger: Notifications.NotificationTriggerInput;

    if (date) {
      // Calculate time interval from now
      const targetDate = typeof date === "string" ? new Date(date) : date;
      const now = new Date();
      const secondsFromNow = Math.floor((targetDate.getTime() - now.getTime()) / 1000);

      // Use time interval trigger if the date is in the future
      if (secondsFromNow > 0) {
        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsFromNow,
          repeats: false,
          channelId: androidChannel(options),
        };
      } else {
        // If date is in the past, don't schedule
        console.warn(`Notification date is in the past: ${date}`);
        return { success: false, message: "Cannot schedule notification in the past" };
      }
    } else {
      // Immediate notification
      trigger = null;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });

    return { success: true, id };
  } catch (error) {
    console.error("Notification scheduling failed:", error);
    return { success: false, message: `Failed to schedule notification: ${error}` };
  }
};

/**
 * Schedule a recurring daily notification
 */
export const scheduleRecurringNotification = async (
  hour: number, // 0-23 hour format
  minute: number = 0, // 0-59 minute format, defaults to 0
  notificationInput: NotificationContentInput,
  options?: NotificationOptions & { timezone?: string; weekday?: number }
) => {
  const { status } = await checkPermissions();

  if (status !== PermissionStatus.GRANTED) {
    return { success: false, message: "Notifications permission not granted" };
  }

  try {
    const content = buildContent(notificationInput, options);

    // A weekday yields a weekly repeat (e.g. Friday Al-Kahf); otherwise a daily
    // repeat in the device timezone. Both are native OS-repeating triggers.
    const channelId = androidChannel(options);
    const trigger: Notifications.NotificationTriggerInput = options?.weekday
      ? {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: options.weekday,
          hour,
          minute,
          channelId,
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId,
        };

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });

    return { success: true, id };
  } catch (error) {
    console.error("Recurring notification scheduling failed:", error);
    return { success: false, message: `Failed to schedule recurring notification: ${error}` };
  }
};

// Store subscriptions for cleanup
let notificationReceivedSubscription: Notifications.EventSubscription | null = null;

// Configure base notification handler and setup listeners
export const configureNotifications = () => {
  try {
    // Clean up existing listeners first
    cleanupNotificationListeners();

    // Set up notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Set up notification listeners with proper subscription management
    notificationReceivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        try {
          console.log("[Notifications] Notification received:", notification.request.identifier);
          console.log("[Notifications] Content:", notification.request.content);
          // Add any custom handling for received notifications here
        } catch (error) {
          console.error("[Notifications] Error handling received notification:", error);
        }
      }
    );

    // Register cleanup with the cleanup manager
    cleanupManager.register(
      "notification-listeners",
      cleanupNotificationListeners,
      10 // High priority - cleanup notifications before other resources
    );

    console.log("[Notifications] Notification listeners configured successfully");
  } catch (error) {
    console.error("[Notifications] Error configuring notifications:", error);
  }
};

// Clean up notification listeners to prevent memory leaks
export const cleanupNotificationListeners = () => {
  try {
    if (notificationReceivedSubscription) {
      notificationReceivedSubscription.remove();
      notificationReceivedSubscription = null;
    }

    console.log("[Notifications] Cleaned up notification listeners successfully");
  } catch (error) {
    console.error("[Notifications] Error cleaning up notification listeners:", error);
    // Force reset subscriptions even if cleanup fails
    notificationReceivedSubscription = null;
  }
};

export const checkPermissions = async () => {
  const { status } = await Notifications.getPermissionsAsync();
  return { status };
};

export const requestNotificationPermission = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  return { status };
};

export const listScheduledNotifications = async () => {
  const { status } = await checkPermissions();
  return status === PermissionStatus.GRANTED
    ? Notifications.getAllScheduledNotificationsAsync()
    : [];
};

export const cancelAllScheduledNotifications = async () => {
  console.log("Canceling all scheduled notification");
  await Notifications.cancelAllScheduledNotificationsAsync();
};
