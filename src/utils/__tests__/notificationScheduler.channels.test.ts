import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { addHours } from "date-fns";

import { ATHKAR_TYPE } from "@/constants/Athkar";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import type { PrayerSoundKey } from "@/constants/sounds";
import type { NotificationSettings } from "@/types/notification";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { scheduleNotification } from "@/utils/notifications";
import { scheduleAllNotifications } from "@/utils/notificationScheduler";

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
jest.mock("expo-alarm", () => ({ scheduleAthan: jest.fn(), cancelAllAthans: jest.fn() }));
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

const TIMEZONE = "UTC";
const FAJR_SOUND: PrayerSoundKey = "athan2";

const created = Notifications.setNotificationChannelAsync as jest.Mock;
const scheduled = scheduleNotification as jest.Mock;

// Every type on, and overrides that change the sound and vibration per prayer.
const SETTINGS: NotificationSettings = {
  enabled: true,
  defaults: {
    prayer: { enabled: true, sound: "makkahAthan1", vibration: true },
    iqama: { enabled: true, sound: "iqama1", vibration: true, timing: 10 },
    preAthan: { enabled: true, sound: "tasbih", vibration: true, timing: 15 },
    qada: { enabled: false, sound: "tasbih", vibration: true },
  },
  overrides: {
    [PRAYER_ID.FAJR]: {
      [NOTIFICATION_TYPE.PRAYER]: { sound: FAJR_SOUND, vibration: false },
      [NOTIFICATION_TYPE.PRE_ATHAN]: { vibration: false },
    },
    [PRAYER_ID.ASR]: { [NOTIFICATION_TYPE.IQAMA]: { vibration: false } },
  },
};

const ATHKAR = {
  morningNotification: { type: ATHKAR_TYPE.MORNING, enabled: false, hour: 6, minute: 0 },
  eveningNotification: { type: ATHKAR_TYPE.EVENING, enabled: false, hour: 18, minute: 0 },
};

const dayOfPrayers = (): DayPrayerTimes => {
  const at = (hours: number) => addHours(new Date(), hours).toISOString();
  return {
    date: Date.now(),
    timezone: TIMEZONE,
    timings: {
      [PRAYER_ID.FAJR]: at(2),
      [PRAYER_ID.DHUHR]: at(4),
      [PRAYER_ID.ASR]: at(6),
      [PRAYER_ID.MAGHRIB]: at(8),
      [PRAYER_ID.ISHA]: at(10),
    },
    otherTimings: {
      [OTHER_TIMING.SUNRISE]: at(3),
      [OTHER_TIMING.SUNSET]: at(8),
      [OTHER_TIMING.IMSAK]: at(1),
      [OTHER_TIMING.MIDNIGHT]: at(12),
      [OTHER_TIMING.FIRST_THIRD]: at(11),
      [OTHER_TIMING.LAST_THIRD]: at(14),
    },
  };
};

const runScheduler = (playback: { fullAthanPlayback: boolean; fullIqamaPlayback: boolean }) =>
  scheduleAllNotifications(SETTINGS, ATHKAR, [dayOfPrayers()], TIMEZONE, null, playback);

// Android posts a notification on a missing channel to its fallback channel.
describe("the scheduler and the channels it creates", () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "android");
    created.mockClear();
    scheduled.mockClear();
  });

  it.each([
    { fullAthanPlayback: false, fullIqamaPlayback: false },
    { fullAthanPlayback: true, fullIqamaPlayback: true },
  ])(
    "schedules every prayer alert on a channel it created (full playback $fullAthanPlayback)",
    async (playback) => {
      const result = await runScheduler(playback);
      expect(result.success).toBe(true);

      const madeIds = new Set(created.mock.calls.map(([id]) => id));
      const usedIds = scheduled.mock.calls
        .map(([, , options]) => options?.channelId)
        .filter((id): id is string => id !== undefined);

      expect(usedIds.length).toBeGreaterThan(0);
      for (const id of usedIds) {
        expect(madeIds).toContain(id);
      }
    }
  );
});
