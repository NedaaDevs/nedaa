import * as Notifications from "expo-notifications";

import { PermissionStatus } from "expo-notifications";

// Check the current notification permission
export const checkNotificationPermission = async () => {
  await Notifications.getPermissionsAsync();
};

// Request the notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return status === PermissionStatus.GRANTED;
};
