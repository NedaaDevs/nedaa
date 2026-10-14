import { Linking, Platform } from "react-native";
import * as Application from "expo-application";
import {
  areLiveActivitiesEnabled,
  canDrawOverlays,
  canScheduleExactAlarms,
  canUseFullScreenIntent,
  getAuthorizationStatus,
  isBatteryOptimizationExempt,
  requestAuthorization,
  requestBatteryOptimizationExemption,
  requestDrawOverlaysPermission,
  requestExactAlarmPermission,
  requestFullScreenIntentPermission,
} from "expo-alarm";
import { PermissionStatus } from "expo-notifications";

import { ALARM_PERMISSION, isNeededPermission, type AlarmPermissionId } from "@/constants/Alarm";
import {
  ANDROID_APP_NOTIFICATION_SETTINGS_ACTION,
  ANDROID_EXTRA_APP_PACKAGE,
  ANDROID_PACKAGE_ID,
  IOS_APP_SETTINGS_URL,
} from "@/constants/App";
import { PlatformType } from "@/enums/app";
import { alarmSupport } from "@/utils/alarmSupport";
import { checkPermissions, requestNotificationPermission } from "@/utils/notifications";

export type AlarmPermission = {
  id: AlarmPermissionId;
  granted: boolean;
  /** False when only the system settings can grant it. */
  canRequestInApp: boolean;
};

const settingsOnly = (id: AlarmPermissionId, granted: boolean): AlarmPermission => ({
  id,
  granted,
  canRequestInApp: false,
});

const readIOS = async (): Promise<AlarmPermission[]> => {
  // Below AlarmKit's OS floor, or when its check fails, nothing to grant.
  if (!(await alarmSupport())) return [];
  const [status, liveActivities] = await Promise.all([
    getAuthorizationStatus(),
    areLiveActivitiesEnabled(),
  ]);
  return [
    {
      id: ALARM_PERMISSION.ALARMKIT,
      granted: status === "authorized",
      canRequestInApp: status !== "denied",
    },
    // iOS 27 keeps AlarmKit alarms silent while Live Activities are off.
    settingsOnly(ALARM_PERMISSION.LIVE_ACTIVITIES, liveActivities),
  ];
};

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

const openAppSettings = () => {
  if (Platform.OS === PlatformType.IOS) {
    Linking.openURL(IOS_APP_SETTINGS_URL);
  } else {
    Linking.openSettings();
  }
};

const openNotificationSettings = () => {
  if (Platform.OS === PlatformType.ANDROID) {
    Linking.sendIntent(ANDROID_APP_NOTIFICATION_SETTINGS_ACTION, [
      {
        key: ANDROID_EXTRA_APP_PACKAGE,
        value: Application.applicationId ?? ANDROID_PACKAGE_ID,
      },
    ]).catch(() => Linking.openSettings());
  } else {
    openAppSettings();
  }
};

const REQUEST_PERMISSION: Record<
  AlarmPermissionId,
  (permission: AlarmPermission) => Promise<unknown> | void
> = {
  [ALARM_PERMISSION.ALARMKIT]: async ({ canRequestInApp }) => {
    // Once denied, iOS stops prompting and only Settings can grant it.
    if ((await requestAuthorization()) === "denied" && !canRequestInApp) openAppSettings();
  },
  [ALARM_PERMISSION.LIVE_ACTIVITIES]: () => openAppSettings(),
  [ALARM_PERMISSION.NOTIFICATIONS]: ({ canRequestInApp }) =>
    canRequestInApp ? requestNotificationPermission() : openNotificationSettings(),
  [ALARM_PERMISSION.EXACT_ALARM]: () => {
    requestExactAlarmPermission();
  },
  [ALARM_PERMISSION.FULL_SCREEN]: () => {
    requestFullScreenIntentPermission();
  },
  [ALARM_PERMISSION.OVERLAY]: () => {
    requestDrawOverlaysPermission();
  },
  [ALARM_PERMISSION.BATTERY]: () => {
    requestBatteryOptimizationExemption();
  },
};

/** Asks for one permission as its platform allows: a prompt or its screen. */
export const requestAlarmPermission = async (permission: AlarmPermission) => {
  await REQUEST_PERMISSION[permission.id](permission);
};

/** True when every permission an alarm needs to ring is granted. */
export const canRing = (permissions: readonly AlarmPermission[]) =>
  // An empty list means no alarm support, not nothing missing.
  permissions.length > 0 &&
  permissions.every(({ id, granted }) => granted || !isNeededPermission(id));
