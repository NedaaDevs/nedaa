import { Linking, Platform } from "react-native";
import * as ExpoAlarm from "expo-alarm";
import type { AuthorizationStatus } from "expo-alarm";
import { PermissionStatus } from "expo-notifications";

import { ALARM_PERMISSION, type AlarmPermissionId } from "@/constants/Alarm";
import { PlatformType, type PlatformTypeValue } from "@/enums/app";
import { IOS_APP_SETTINGS_URL } from "@/constants/App";
import { canRing, readAlarmPermissions, requestAlarmPermission } from "@/utils/alarmPermissions";
import { alarmSupport } from "@/utils/alarmSupport";
import { checkPermissions, requestNotificationPermission } from "@/utils/notifications";

jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  getAuthorizationStatus: jest.fn(),
  areLiveActivitiesEnabled: jest.fn(),
  canScheduleExactAlarms: jest.fn(),
  canUseFullScreenIntent: jest.fn(),
  canDrawOverlays: jest.fn(),
  isBatteryOptimizationExempt: jest.fn(),
  requestAuthorization: jest.fn(),
  requestExactAlarmPermission: jest.fn(),
  requestFullScreenIntentPermission: jest.fn(),
  requestDrawOverlaysPermission: jest.fn(),
  requestBatteryOptimizationExemption: jest.fn(),
}));
jest.mock("@/utils/alarmSupport", () => ({ alarmSupport: jest.fn() }));
jest.mock("@/utils/notifications", () => ({
  checkPermissions: jest.fn(),
  requestNotificationPermission: jest.fn(),
}));

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
    jest.mocked(alarmSupport).mockResolvedValue(false);

    expect(await readAlarmPermissions()).toEqual([]);
  });

  it.each([
    ["authorized", true, true],
    ["notDetermined", false, true],
    ["denied", false, false],
  ] as const)("reads AlarmKit %s on iOS", async (status, granted, canRequestInApp) => {
    onPlatform(PlatformType.IOS);
    jest.mocked(alarmSupport).mockResolvedValue(true);
    alarm.getAuthorizationStatus.mockResolvedValue(status);
    alarm.areLiveActivitiesEnabled.mockResolvedValue(true);

    expect(await readAlarmPermissions()).toEqual([
      { id: ALARM_PERMISSION.ALARMKIT, granted, canRequestInApp },
      { id: ALARM_PERMISSION.LIVE_ACTIVITIES, granted: true, canRequestInApp: false },
    ]);
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
    expect((await readAlarmPermissions()).every(({ granted }) => granted)).toBe(true);
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
    [ALARM_PERMISSION.EXACT_ALARM, () => alarm.canScheduleExactAlarms.mockReturnValue(false)],
    [ALARM_PERMISSION.FULL_SCREEN, () => alarm.canUseFullScreenIntent.mockReturnValue(false)],
    [ALARM_PERMISSION.OVERLAY, () => alarm.canDrawOverlays.mockReturnValue(false)],
    [ALARM_PERMISSION.BATTERY, () => alarm.isBatteryOptimizationExempt.mockReturnValue(false)],
    [ALARM_PERMISSION.NOTIFICATIONS, () => notificationStatus(PermissionStatus.DENIED)],
  ])("reads %s as the one item not granted on Android", async (id, revoke) => {
    onPlatform(PlatformType.ANDROID);
    grantAllAndroid();
    revoke();

    const missing = (await readAlarmPermissions()).filter(({ granted }) => !granted);
    expect(missing.map((item) => item.id)).toEqual([id]);
  });
});

describe("Live Activities on iOS", () => {
  beforeEach(() => {
    onPlatform(PlatformType.IOS);
    jest.mocked(alarmSupport).mockResolvedValue(true);
    alarm.getAuthorizationStatus.mockResolvedValue("authorized");
  });

  it("reports Live Activities after AlarmKit, granted only in Settings", async () => {
    alarm.areLiveActivitiesEnabled.mockResolvedValue(false);

    expect(await readAlarmPermissions()).toEqual([
      { id: ALARM_PERMISSION.ALARMKIT, granted: true, canRequestInApp: true },
      { id: ALARM_PERMISSION.LIVE_ACTIVITIES, granted: false, canRequestInApp: false },
    ]);
  });

  it("cannot ring with Live Activities off, and can with them on", async () => {
    alarm.areLiveActivitiesEnabled.mockResolvedValue(false);
    expect(canRing(await readAlarmPermissions())).toBe(false);

    alarm.areLiveActivitiesEnabled.mockResolvedValue(true);
    expect(canRing(await readAlarmPermissions())).toBe(true);
  });

  it("opens the app's Settings page for Live Activities", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    await requestAlarmPermission({
      id: ALARM_PERMISSION.LIVE_ACTIVITIES,
      granted: false,
      canRequestInApp: false,
    });

    expect(open).toHaveBeenCalledWith(IOS_APP_SETTINGS_URL);
  });
});

// The reader's canRequestInApp picks the route: in-app prompt, else a screen.
describe("requestAlarmPermission over what the reader reports", () => {
  /** The in-app prompt of each item that has one. */
  const PROMPT: Partial<Record<AlarmPermissionId, jest.Mock>> = {
    [ALARM_PERMISSION.ALARMKIT]: alarm.requestAuthorization,
    [ALARM_PERMISSION.NOTIFICATIONS]: jest.mocked(requestNotificationPermission),
  };
  /** Every way a request leaves the app for a system settings screen. */
  const SCREENS = [
    () => Linking.openURL,
    () => Linking.openSettings,
    () => Linking.sendIntent,
    () => alarm.requestExactAlarmPermission,
    () => alarm.requestFullScreenIntentPermission,
    () => alarm.requestDrawOverlaysPermission,
    () => alarm.requestBatteryOptimizationExemption,
  ];
  const screenOpened = () => SCREENS.some((screen) => jest.mocked(screen()).mock.calls.length > 0);

  /** An iOS device with AlarmKit; `answer` is what its prompt returns. */
  const ios =
    (status: AuthorizationStatus, liveActivities: boolean, answer = status) =>
    () => {
      jest.mocked(alarmSupport).mockResolvedValue(true);
      alarm.getAuthorizationStatus.mockResolvedValue(status);
      alarm.areLiveActivitiesEnabled.mockResolvedValue(liveActivities);
      alarm.requestAuthorization.mockResolvedValue(answer);
    };
  /** An Android device with every item granted but what `revoke` takes away. */
  const android = (revoke: () => void) => () => {
    grantAllAndroid();
    revoke();
  };
  const { IOS, ANDROID } = PlatformType;
  const ROWS: readonly [string, PlatformTypeValue, AlarmPermissionId, () => void][] = [
    [
      "AlarmKit not asked yet",
      IOS,
      ALARM_PERMISSION.ALARMKIT,
      ios("notDetermined", true, "authorized"),
    ],
    [
      "AlarmKit declined at its prompt",
      IOS,
      ALARM_PERMISSION.ALARMKIT,
      ios("notDetermined", true, "denied"),
    ],
    ["AlarmKit denied before", IOS, ALARM_PERMISSION.ALARMKIT, ios("denied", true)],
    ["Live Activities off", IOS, ALARM_PERMISSION.LIVE_ACTIVITIES, ios("authorized", false)],
    [
      "notifications not asked yet",
      ANDROID,
      ALARM_PERMISSION.NOTIFICATIONS,
      android(() => notificationStatus(PermissionStatus.UNDETERMINED)),
    ],
    [
      "notifications denied",
      ANDROID,
      ALARM_PERMISSION.NOTIFICATIONS,
      android(() => notificationStatus(PermissionStatus.DENIED)),
    ],
    [
      "exact alarms off",
      ANDROID,
      ALARM_PERMISSION.EXACT_ALARM,
      android(() => alarm.canScheduleExactAlarms.mockReturnValue(false)),
    ],
    [
      "full-screen alarms off",
      ANDROID,
      ALARM_PERMISSION.FULL_SCREEN,
      android(() => alarm.canUseFullScreenIntent.mockReturnValue(false)),
    ],
    [
      "the overlay off",
      ANDROID,
      ALARM_PERMISSION.OVERLAY,
      android(() => alarm.canDrawOverlays.mockReturnValue(false)),
    ],
    [
      "battery limits on",
      ANDROID,
      ALARM_PERMISSION.BATTERY,
      android(() => alarm.isBatteryOptimizationExempt.mockReturnValue(false)),
    ],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    jest.spyOn(Linking, "sendIntent").mockResolvedValue(undefined);
  });

  it("covers every alarm permission", () => {
    expect(new Set(ROWS.map(([, , id]) => id))).toEqual(new Set(Object.values(ALARM_PERMISSION)));
  });

  it.each(ROWS)("routes %s", async (_name, os, id, device) => {
    onPlatform(os);
    device();
    const item = (await readAlarmPermissions()).find((read) => read.id === id);
    if (!item) throw new Error(`${id} was not read`);

    await requestAlarmPermission(item);

    const prompted = PROMPT[id]?.mock.calls.length === 1;
    // A settings-only item may still ask its prompt first, as AlarmKit does.
    expect({ prompted, screen: screenOpened() }).toEqual(
      item.canRequestInApp
        ? { prompted: true, screen: false }
        : { prompted: expect.any(Boolean), screen: true }
    );
  });
});

describe("canRing", () => {
  it("cannot ring with nothing to grant", () => {
    expect(canRing([])).toBe(false);
  });

  it("rings on Android with notifications and exact alarms, without the extras", async () => {
    onPlatform(PlatformType.ANDROID);
    grantAllAndroid();
    alarm.canUseFullScreenIntent.mockReturnValue(false);
    alarm.canDrawOverlays.mockReturnValue(false);
    alarm.isBatteryOptimizationExempt.mockReturnValue(false);

    expect(canRing(await readAlarmPermissions())).toBe(true);
  });

  it.each([
    ["exact alarms", () => alarm.canScheduleExactAlarms.mockReturnValue(false)],
    ["notifications", () => notificationStatus(PermissionStatus.DENIED)],
  ])("cannot ring on Android without %s", async (_name, revoke) => {
    onPlatform(PlatformType.ANDROID);
    grantAllAndroid();
    revoke();

    expect(canRing(await readAlarmPermissions())).toBe(false);
  });
});
