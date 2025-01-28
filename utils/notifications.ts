import * as Notifications from "expo-notifications";
import { PermissionStatus } from "expo-notifications";
import { LocalPermissionStatus } from "@/enums/notifications";

export const configureNotifications = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
};

export const mapToLocalStatus = (
  expoStatus: PermissionStatus,
): LocalPermissionStatus => {
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

export const scheduleNotification = async (
  seconds: number,
  title: string,
  message: string,
) => {
  const { status } = await checkPermissions();

  if (status !== PermissionStatus.GRANTED) {
    return { success: false, message: "Notifications permission not granted" };
  }

  try {
    const trigger = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: seconds,
      repeats: false,
      channelId: "new_testing",
    };

    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body: message, sound: "default" },
      trigger,
    });
    return { success: true, id };
  } catch (error) {
    return { success: false, message: "Failed to schedule notification" };
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
