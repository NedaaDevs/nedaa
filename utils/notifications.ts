import * as Notifications from "expo-notifications";
import { PermissionStatus, AndroidImportance } from "expo-notifications";
import { Platform, AppState } from "react-native";

// Enums
import { LocalPermissionStatus } from "@/enums/notifications";
import { PlatformType } from "@/enums/app";

// Constants
const ANDROID_CHANNEL_ID = "prayer_times";
const ANDROID_CHANNEL_NAME = "Prayer Time Alerts";

export const configureNotifications = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Check channel when app comes to foreground
  AppState.addEventListener("change", handleAppStateChange);
};

const handleAppStateChange = (state: string) => {
  if (state === "active") checkAndroidChannel();
};

// Channel management for Android
export const checkAndroidChannel = async () => {
  if (Platform.OS !== PlatformType.ANDROID) return;

  try {
    const channels = await Notifications.getNotificationChannelsAsync();
    const channelExists = channels.some((c) => c.id === ANDROID_CHANNEL_ID);

    if (!channelExists) {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: ANDROID_CHANNEL_NAME,
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
      });
      console.log("Android notification channel created");
    }
  } catch (error) {
    console.error("Failed to check/create Android channel:", error);
  }
};

// Enhanced permission check with channel verification
export const checkPermissions = async () => {
  const { status } = await Notifications.getPermissionsAsync();

  if (status === PermissionStatus.GRANTED && Platform.OS === PlatformType.ANDROID) {
    await checkAndroidChannel();
  }

  return { status };
};

export const requestPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });

  if (status === PermissionStatus.GRANTED && Platform.OS === PlatformType.ANDROID) {
    await checkAndroidChannel();
  }

  return { status };
};

export const scheduleNotification = async (seconds: number, title: string, message: string) => {
  const { status } = await checkPermissions();

  if (status !== PermissionStatus.GRANTED) {
    return { success: false, message: "Notifications permission not granted" };
  }

  try {
    const trigger = {
      seconds,
      repeats: false,
      channelId: ANDROID_CHANNEL_ID,
    };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        sound: "default",
        ...(Platform.OS === PlatformType.ANDROID && {
          android: { channelId: ANDROID_CHANNEL_ID },
        }),
      },
      trigger,
    });

    return { success: true, id };
  } catch (error) {
    console.error("Notification scheduling failed:", error);
    return { success: false, message: `Failed to schedule notification: ${error}` };
  }
};

export const mapToLocalStatus = (expoStatus: PermissionStatus): LocalPermissionStatus => {
  switch (expoStatus) {
    case PermissionStatus.GRANTED:
      return LocalPermissionStatus.GRANTED;
    case PermissionStatus.DENIED:
      return LocalPermissionStatus.DENIED;
    default:
      return LocalPermissionStatus.UNDETERMINED;
  }
};

export const listScheduledNotifications = async () => {
  const { status } = await checkPermissions();
  return status === PermissionStatus.GRANTED
    ? Notifications.getAllScheduledNotificationsAsync()
    : [];
};

export const cancelAllScheduledNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
