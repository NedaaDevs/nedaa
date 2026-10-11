import { Platform } from "react-native";
import { cancelAllAthans } from "expo-alarm";

import { ATHKAR_TYPE } from "@/constants/Athkar";
import { PRAYER_ID } from "@/constants/Prayer";
import { PlatformType } from "@/enums/app";
import { SchedulingSkipReason } from "@/enums/notifications";
import type { NotificationSettings } from "@/types/notification";
import { cancelAllScheduledNotifications } from "@/utils/notifications";
import { cancelAllAlerts, scheduleAllNotifications } from "@/utils/notificationScheduler";

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  PermissionStatus: { GRANTED: "granted" },
  getNotificationChannelsAsync: jest.fn(() => Promise.resolve([])),
  deleteNotificationChannelAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}));
jest.mock("@/utils/notifications", () => ({
  checkPermissions: jest.fn(() => Promise.resolve({ status: "granted" })),
  cancelAllScheduledNotifications: jest.fn(),
  scheduleNotification: jest.fn(() => Promise.resolve({ success: true })),
  scheduleRecurringNotification: jest.fn(() => Promise.resolve({ success: true })),
}));
jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  scheduleAthan: jest.fn(),
  cancelAllAthans: jest.fn(),
}));
jest.mock("@/utils/qadaNotificationScheduler", () => ({ scheduleQadaNotifications: jest.fn() }));
jest.mock("@/stores/customSounds", () => ({
  useCustomSoundsStore: { getState: () => ({ customSounds: [] }) },
}));
jest.mock("@/stores/quranReminders", () => ({
  useQuranRemindersStore: { getState: () => ({ reminders: [] }) },
}));
// The sound helpers reach the athkar store, which opens SQLite.
jest.mock("@/stores/athkar", () => ({ useAthkarStore: { getState: jest.fn() } }));
jest.mock("@/utils/customSoundManager", () => ({
  isCustomSoundKey: () => false,
  createChannelWithCustomSound: jest.fn(),
}));

const SETTINGS: NotificationSettings = {
  enabled: true,
  defaults: {
    prayer: { enabled: true, sound: "makkahAthan1", vibration: true },
    iqama: { enabled: true, sound: "iqama1", vibration: true, timing: 10 },
    preAthan: { enabled: false, sound: "tasbih", vibration: true, timing: 15 },
    qada: { enabled: false, sound: "tasbih", vibration: true },
  },
  overrides: { [PRAYER_ID.FAJR]: {} },
};

const ATHKAR = {
  morningNotification: { type: ATHKAR_TYPE.MORNING, enabled: false, hour: 6, minute: 0 },
  eveningNotification: { type: ATHKAR_TYPE.EVENING, enabled: false, hour: 18, minute: 0 },
};

// A cancel before a failed run leaves the device with no prayer alerts.
describe("a run with no prayer days", () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    jest.clearAllMocks();
  });

  it("keeps every existing booking", async () => {
    const result = await scheduleAllNotifications(SETTINGS, ATHKAR, [], "UTC", null, {
      fullAthanPlayback: true,
      fullIqamaPlayback: true,
    });

    expect(result.success).toBe(false);
    expect(result.skipReason).toBe(SchedulingSkipReason.NO_PRAYER_TIMES);
    expect(cancelAllScheduledNotifications).not.toHaveBeenCalled();
    expect(cancelAllAthans).not.toHaveBeenCalled();
  });
});

// A native athan outlives its notification unless both are cancelled.
describe("cancelling every alert", () => {
  beforeEach(() => jest.clearAllMocks());

  it("cancels the native athans with the notifications on Android", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);

    await cancelAllAlerts();

    expect(cancelAllAthans).toHaveBeenCalledTimes(1);
    expect(cancelAllScheduledNotifications).toHaveBeenCalledTimes(1);
  });

  it("cancels only the notifications on iOS", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.IOS);

    await cancelAllAlerts();

    expect(cancelAllAthans).not.toHaveBeenCalled();
    expect(cancelAllScheduledNotifications).toHaveBeenCalledTimes(1);
  });
});
