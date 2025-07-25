import * as Notifications from "expo-notifications";
import {
  PermissionStatus,
  AndroidImportance,
  NotificationContentInput,
  AndroidNotificationPriority,
} from "expo-notifications";
import { Platform, AppState } from "react-native";

// Services
import { cleanupManager } from "@/services/cleanup";

// Enums
import { PlatformType } from "@/enums/app";

// Types
import type { NotificationOptions } from "@/types/notification";

// Constants
const ANDROID_CHANNEL_ID = "prayer_times";
const ANDROID_CHANNEL_NAME = "Prayer Time Alerts";

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
    // Prepare notification content
    const content: NotificationContentInput = {
      ...notificationInput,
      data: {
        ...notificationInput.data,
        categoryId: options?.categoryId,
      },
    };

    // Platform-specific settings
    if (Platform.OS === PlatformType.ANDROID) {
      content.priority = AndroidNotificationPriority.HIGH;

      // For Android < 8.0, sound must be in the content
      if (notificationInput.sound && notificationInput.sound !== "default") {
        content.sound = notificationInput.sound;
      }

      // Android vibration
      if (options?.vibrate !== undefined) {
        content.vibrate = options.vibrate ? [0, 500, 200, 500] : [];
      }
    } else if (Platform.OS === PlatformType.IOS) {
      // iOS specific settings
      content.interruptionLevel = "timeSensitive";

      // iOS always needs sound in content
      if (notificationInput.sound) {
        content.sound = notificationInput.sound;
      }
    }

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
        };

        // IMPORTANT: For Android 8.0+, use the channelId passed in options
        if (Platform.OS === PlatformType.ANDROID && options?.channelId) {
          trigger.channelId = options.channelId;
        }
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
  options?: NotificationOptions & { timezone?: string }
) => {
  const { status } = await checkPermissions();

  if (status !== PermissionStatus.GRANTED) {
    return { success: false, message: "Notifications permission not granted" };
  }

  try {
    // Prepare notification content
    const content: NotificationContentInput = {
      ...notificationInput,
      data: {
        ...notificationInput.data,
        categoryId: options?.categoryId,
      },
    };

    // Platform-specific settings
    if (Platform.OS === PlatformType.ANDROID) {
      content.priority = AndroidNotificationPriority.HIGH;

      // For Android < 8.0, sound must be in the content
      if (notificationInput.sound && notificationInput.sound !== "default") {
        content.sound = notificationInput.sound;
      }

      // Android vibration
      if (options?.vibrate !== undefined) {
        content.vibrate = options.vibrate ? [0, 500, 200, 500] : [];
      }
    } else if (Platform.OS === PlatformType.IOS) {
      // iOS specific settings
      content.interruptionLevel = "timeSensitive";

      // iOS always needs sound in content
      if (notificationInput.sound) {
        content.sound = notificationInput.sound;
      }
    }

    let trigger: Notifications.NotificationTriggerInput;

    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
      timezone: options?.timezone,
    };

    // Use simple daily trigger for device timezone when no timezone specified
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    };

    // IMPORTANT: For Android 8.0+, use the channelId passed in options
    if (Platform.OS === PlatformType.ANDROID && options?.channelId) {
      (trigger as any).channelId = options.channelId;
    }

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
let notificationResponseSubscription: Notifications.EventSubscription | null = null;
let appStateSubscription: { remove: () => void } | null = null;

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

    notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        try {
          console.log(
            "[Notifications] Notification response:",
            response.notification.request.identifier
          );
          console.log("[Notifications] Action:", response.actionIdentifier);
          // Handle notification tap/action here if needed
        } catch (error) {
          console.error("[Notifications] Error handling notification response:", error);
        }
      }
    );

    // Add app state change listener for Android channels
    appStateSubscription = AppState.addEventListener("change", (state) => {
      try {
        if (state === "active") {
          setupNotificationChannels();
        }
      } catch (error) {
        console.error("[Notifications] Error handling app state change:", error);
      }
    });

    // Setup channels on app start
    setupNotificationChannels();

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

    if (notificationResponseSubscription) {
      notificationResponseSubscription.remove();
      notificationResponseSubscription = null;
    }

    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }

    console.log("[Notifications] Cleaned up notification listeners successfully");
  } catch (error) {
    console.error("[Notifications] Error cleaning up notification listeners:", error);
    // Force reset subscriptions even if cleanup fails
    notificationReceivedSubscription = null;
    notificationResponseSubscription = null;
    appStateSubscription = null;
  }
};

// Check if listeners are currently active (useful for debugging)
export const areListenersActive = (): boolean => {
  return !!(notificationReceivedSubscription && notificationResponseSubscription);
};

export const checkPermissions = async () => {
  const { status } = await Notifications.getPermissionsAsync();

  if (status === PermissionStatus.GRANTED && Platform.OS === PlatformType.ANDROID) {
    await setupNotificationChannels();
  }

  return { status };
};

export const requestNotificationPermission = async () => {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status === PermissionStatus.GRANTED && Platform.OS === PlatformType.ANDROID) {
    await setupNotificationChannels();
  }

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

// Create notification channels for different types (Android)
export const setupNotificationChannels = async () => {
  if (Platform.OS !== PlatformType.ANDROID) return;

  try {
    // Main prayer channel
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: ANDROID_CHANNEL_NAME,
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
    });

    // Iqama reminder channel
    await Notifications.setNotificationChannelAsync("iqama_reminders", {
      name: "Iqama Reminders",
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });

    // Pre-Athan alert channel
    await Notifications.setNotificationChannelAsync("preathan_alerts", {
      name: "Pre-Athan Alerts",
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 200],
    });
  } catch (error) {
    console.error("Failed to create Android channels:", error);
  }
};
