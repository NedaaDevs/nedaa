import { Platform } from "react-native";
import * as ExpoAlarm from "expo-alarm";
import { PermissionStatus } from "expo-notifications";

import { ALARM_PERMISSION } from "@/constants/Alarm";
import { PlatformType, type PlatformTypeValue } from "@/enums/app";
import { alarmPermissionsGranted, readAlarmPermissions } from "@/utils/alarmPermissions";
import { checkPermissions } from "@/utils/notifications";

jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  isAlarmKitAvailable: jest.fn(),
  getAuthorizationStatus: jest.fn(),
  canScheduleExactAlarms: jest.fn(),
  canUseFullScreenIntent: jest.fn(),
  canDrawOverlays: jest.fn(),
  isBatteryOptimizationExempt: jest.fn(),
}));
jest.mock("@/utils/notifications", () => ({ checkPermissions: jest.fn() }));

const alarm = jest.mocked(ExpoAlarm);
const notificationStatus = (status: PermissionStatus) =>
  jest
    .mocked(checkPermissions)
    .mockResolvedValue({ status } as Awaited<ReturnType<typeof checkPermissions>>);

const onPlatform = (os: PlatformTypeValue) => jest.replaceProperty(Platform, "OS", os);

const grantAllAndroid = () => {
  notificationStatus(PermissionStatus.GRANTED);
  alarm.canScheduleExactAlarms.mockReturnValue(true);
  alarm.canUseFullScreenIntent.mockReturnValue(true);
  alarm.canDrawOverlays.mockReturnValue(true);
  alarm.isBatteryOptimizationExempt.mockReturnValue(true);
};

afterEach(() => jest.restoreAllMocks());

describe("readAlarmPermissions", () => {
  it("asks nothing on iOS without AlarmKit", async () => {
    onPlatform(PlatformType.IOS);
    alarm.isAlarmKitAvailable.mockResolvedValue(false);

    expect(await readAlarmPermissions()).toEqual([]);
    expect(await alarmPermissionsGranted()).toBe(true);
  });

  it.each([
    ["authorized", true, true],
    ["notDetermined", false, true],
    ["denied", false, false],
  ] as const)("reads AlarmKit %s on iOS", async (status, granted, canRequestInApp) => {
    onPlatform(PlatformType.IOS);
    alarm.isAlarmKitAvailable.mockResolvedValue(true);
    alarm.getAuthorizationStatus.mockResolvedValue(status);

    expect(await readAlarmPermissions()).toEqual([
      { id: ALARM_PERMISSION.ALARMKIT, granted, canRequestInApp },
    ]);
    expect(await alarmPermissionsGranted()).toBe(granted);
  });

  it("asks Android for every alarm permission, notifications first", async () => {
    onPlatform(PlatformType.ANDROID);
    grantAllAndroid();

    expect((await readAlarmPermissions()).map(({ id }) => id)).toEqual([
      ALARM_PERMISSION.NOTIFICATIONS,
      ALARM_PERMISSION.EXACT_ALARM,
      ALARM_PERMISSION.FULL_SCREEN,
      ALARM_PERMISSION.OVERLAY,
      ALARM_PERMISSION.BATTERY,
    ]);
    expect(await alarmPermissionsGranted()).toBe(true);
  });

  it("offers the notification prompt in the app only before it was answered", async () => {
    onPlatform(PlatformType.ANDROID);
    grantAllAndroid();
    notificationStatus(PermissionStatus.UNDETERMINED);
    const [undetermined] = await readAlarmPermissions();
    expect(undetermined).toEqual({
      id: ALARM_PERMISSION.NOTIFICATIONS,
      granted: false,
      canRequestInApp: true,
    });

    notificationStatus(PermissionStatus.DENIED);
    const [denied] = await readAlarmPermissions();
    expect(denied.canRequestInApp).toBe(false);
  });

  it.each([
    ["exact alarms", () => alarm.canScheduleExactAlarms.mockReturnValue(false)],
    ["full-screen alerts", () => alarm.canUseFullScreenIntent.mockReturnValue(false)],
    ["the overlay", () => alarm.canDrawOverlays.mockReturnValue(false)],
    ["the battery exemption", () => alarm.isBatteryOptimizationExempt.mockReturnValue(false)],
    ["notifications", () => notificationStatus(PermissionStatus.DENIED)],
  ])("is not granted on Android without %s", async (_name, revoke) => {
    onPlatform(PlatformType.ANDROID);
    grantAllAndroid();
    revoke();

    expect(await alarmPermissionsGranted()).toBe(false);
  });
});
