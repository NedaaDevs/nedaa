import * as Notifications from "expo-notifications";
import {
  PermissionStatus,
  AndroidImportance,
  NotificationContentInput,
  AndroidNotificationPriority,
} from "expo-notifications";
import { Platform, AppState } from "react-native";

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

// Configure base notification handler and setup listeners
export const configureNotifications = () => {
  // Set up notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Set up notification listeners
  Notifications.addNotificationReceivedListener((notification) => {
    console.log("Notification received:", notification);
  });

  Notifications.addNotificationResponseReceivedListener((response) => {
    console.log("Notification response:", response);
  });

  // Add app state change listener for Android channels
  AppState.addEventListener("change", (state) => {
    if (state === "active") setupNotificationChannels();
  });

  // Setup channels on app start
  setupNotificationChannels();
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

    console.log("Android notification channels created");
  } catch (error) {
    console.error("Failed to create Android channels:", error);
  }
};
