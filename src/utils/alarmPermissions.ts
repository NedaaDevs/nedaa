import { Platform } from "react-native";
import {
  canDrawOverlays,
  canScheduleExactAlarms,
  canUseFullScreenIntent,
  getAuthorizationStatus,
  isAlarmKitAvailable,
  isBatteryOptimizationExempt,
} from "expo-alarm";
import { PermissionStatus } from "expo-notifications";

import { ALARM_PERMISSION, type AlarmPermissionId } from "@/constants/Alarm";
import { PlatformType } from "@/enums/app";
import { checkPermissions } from "@/utils/notifications";

export type AlarmPermission = {
  id: AlarmPermissionId;
  granted: boolean;
  /** False when only the system settings can grant it. */
  canRequestInApp: boolean;
};

const readIOS = async (): Promise<AlarmPermission[]> => {
  // Below AlarmKit's OS floor there is nothing to grant.
  if (!(await isAlarmKitAvailable())) return [];
  const status = await getAuthorizationStatus();
  return [
    {
      id: ALARM_PERMISSION.ALARMKIT,
      granted: status === "authorized",
      canRequestInApp: status !== "denied",
    },
  ];
};

const settingsOnly = (id: AlarmPermissionId, granted: boolean): AlarmPermission => ({
  id,
  granted,
  canRequestInApp: false,
});

const readAndroid = async (): Promise<AlarmPermission[]> => {
  const { status } = await checkPermissions();
  return [
    {
      id: ALARM_PERMISSION.NOTIFICATIONS,
      granted: status === PermissionStatus.GRANTED,
      canRequestInApp: status === PermissionStatus.UNDETERMINED,
    },
    settingsOnly(ALARM_PERMISSION.EXACT_ALARM, canScheduleExactAlarms()),
    settingsOnly(ALARM_PERMISSION.FULL_SCREEN, canUseFullScreenIntent()),
    // Without it the challenge overlay stops itself and the alarm falls back to
    // a notification.
    settingsOnly(ALARM_PERMISSION.OVERLAY, canDrawOverlays()),
    settingsOnly(ALARM_PERMISSION.BATTERY, isBatteryOptimizationExempt()),
  ];
};

/** What the alarm permission gate asks for, in its order. */
export const readAlarmPermissions = (): Promise<AlarmPermission[]> =>
  Platform.OS === PlatformType.IOS ? readIOS() : readAndroid();

/** True when the alarm permission gate has nothing left to ask. */
export const alarmPermissionsGranted = async (): Promise<boolean> =>
  (await readAlarmPermissions()).every(({ granted }) => granted);
