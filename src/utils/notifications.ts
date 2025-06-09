import * as Notifications from "expo-notifications";
import { PermissionStatus, AndroidImportance } from "expo-notifications";
import { Platform, AppState } from "react-native";

// Enums
import { PlatformType } from "@/enums/app";

// Types
import type { NotificationOptions } from "@/types/notification";

// Constants
const ANDROID_CHANNEL_ID = "prayer_times";
const ANDROID_CHANNEL_NAME = "Prayer Time Alerts";

// Sound file mapping
// const SOUND_FILES = {
//   silent: false, // No sound
// };

export const scheduleNotification = async (
  date: Date | string,
  title: string,
  message: string,
  options?: NotificationOptions
) => {
  const { status } = await checkPermissions();

  if (status !== PermissionStatus.GRANTED) {
    return { success: false, message: "Notifications permission not granted" };
  }

  try {
    // Prepare notification content
    const content: Notifications.NotificationContentInput = {
      title,
      body: message,
      data: {
        categoryId: options?.categoryId,
      },
    };

    // Platform-specific settings
    if (Platform.OS === PlatformType.ANDROID) {
      content.priority = Notifications.AndroidNotificationPriority.MAX;

      // Android vibration
      if (options?.vibrate !== undefined) {
        content.vibrate = options.vibrate ? [0, 500, 200, 500] : [];
      }
    } else if (Platform.OS === PlatformType.IOS) {
      // iOS specific settings
      content.interruptionLevel = "timeSensitive";
    }

    // Schedule the notification
    const trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      repeats: false,
      channelId: ANDROID_CHANNEL_ID,
    };

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

// Create notification channels for different types (Android)
export const setupNotificationChannels = async () => {
  if (Platform.OS !== PlatformType.ANDROID) return;

  try {
    // Main prayer channel
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: ANDROID_CHANNEL_NAME,
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      sound: "default",
    });

    // Iqama reminder channel
    await Notifications.setNotificationChannelAsync("iqama_reminders", {
      name: "Iqama Reminders",
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "gentle_reminder.wav",
    });

    // Pre-Athan alert channel
    await Notifications.setNotificationChannelAsync("preathan_alerts", {
      name: "Pre-Athan Alerts",
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 200],
      sound: "bell_sound.wav",
    });

    console.log("Android notification channels created");
  } catch (error) {
    console.error("Failed to create Android channels:", error);
  }
};

export const configureNotifications = () => {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      return {
        shouldShowAlert: true,
        shouldPlaySound: notification.request.content.sound !== null,
        shouldSetBadge: false,
      };
    },
  });

  // Setup channels on app start
  setupNotificationChannels();

  // Check channels when app comes to foreground
  AppState.addEventListener("change", handleAppStateChange);
};

const handleAppStateChange = (state: string) => {
  if (state === "active") setupNotificationChannels();
};

export const checkPermissions = async () => {
  const { status } = await Notifications.getPermissionsAsync();

  if (status === PermissionStatus.GRANTED && Platform.OS === PlatformType.ANDROID) {
    await setupNotificationChannels();
  }

  return { status };
};

export const requestNotificationPermission = async () => {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  if (status === PermissionStatus.GRANTED && Platform.OS === PlatformType.ANDROID) {
    await setupNotificationChannels();
  }

  return { status };
};
