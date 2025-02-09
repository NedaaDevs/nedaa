import * as Notifications from "expo-notifications";
import { PermissionStatus } from "expo-notifications";
import { LocalPermissionStatus } from "@/enums/notifications";
import { Platform } from "react-native";
import { PlatformType } from "@/enums/app";

export const configureNotifications = async () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === PlatformType.ANDROID) {
    await Notifications.setNotificationChannelAsync("prayer_times", {
      name: "Prayer times channel",
      importance: Notifications.AndroidImportance.MAX,
    });
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

export const checkPermissions = async () => {
  return Notifications.getPermissionsAsync();
};

export const requestPermissions = async () => {
  return Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
};

export const scheduleNotification = async (date: Date, title: string, message: string) => {
  const { status } = await checkPermissions();

  if (status !== PermissionStatus.GRANTED) {
    return { success: false, message: "Notifications permission not granted" };
  }

  try {
    const trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: date,
      repeats: false,
      channelId: "prayer_times",
    };

    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body: message, sound: "default" },
      trigger,
    });
    return { success: true, id };
  } catch (error) {
    return { success: false, message: `Failed to schedule notification: ${error}` };
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
