import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { NOTIFICATION_TYPE } from "@/constants/Notification";
import type { NotificationSettings } from "@/types/notification";
import {
  createNotificationChannels,
  getNotificationChannelId,
  shouldUpdateChannels,
} from "@/utils/notificationChannels";

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  getNotificationChannelsAsync: jest.fn(),
  deleteNotificationChannelAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}));
// The sound helpers reach the athkar store, which opens SQLite.
jest.mock("@/stores/athkar", () => ({ useAthkarStore: { getState: jest.fn() } }));
jest.mock("@/utils/customSoundManager", () => ({
  isCustomSoundKey: () => false,
  createChannelWithCustomSound: jest.fn(),
}));

type Channel = { id: string; sound?: string | null };

const channels = Notifications.getNotificationChannelsAsync as unknown as jest.Mock<
  Promise<Channel[]>
>;
const deleted = Notifications.deleteNotificationChannelAsync as jest.Mock;
const created = Notifications.setNotificationChannelAsync as jest.Mock;

const settings = (preAthanVibration: boolean): NotificationSettings => ({
  enabled: true,
  defaults: {
    prayer: { enabled: true, sound: "makkahAthan1", vibration: true },
    iqama: { enabled: true, sound: "iqama1", vibration: true, timing: 10 },
    preAthan: { enabled: true, sound: "tasbih", vibration: preAthanVibration, timing: 15 },
    qada: { enabled: false, sound: "tasbih", vibration: true },
  },
  overrides: {},
});

const PRE_ATHAN = { sound: "tasbih", vibration: true } as const;

describe("notification channels", () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "android");
    channels.mockResolvedValue([]);
    deleted.mockClear();
    created.mockClear();
  });

  // Android keeps a deleted channel's vibration, so a change needs a new id.
  it("gives a channel a new id when its vibration changes", () => {
    const on = getNotificationChannelId("fajr", NOTIFICATION_TYPE.PRE_ATHAN, PRE_ATHAN);
    const off = getNotificationChannelId("fajr", NOTIFICATION_TYPE.PRE_ATHAN, {
      ...PRE_ATHAN,
      vibration: false,
    });

    expect(on).not.toBe(off);
  });

  it("schedules on exactly the channels it creates", async () => {
    await createNotificationChannels(settings(true));
    const made = new Set(created.mock.calls.map(([id]) => id));
    const config = settings(true).defaults;

    for (const prayer of ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const) {
      expect(made).toContain(
        getNotificationChannelId(prayer, NOTIFICATION_TYPE.PRAYER, config.prayer)
      );
      expect(made).toContain(
        getNotificationChannelId(prayer, NOTIFICATION_TYPE.IQAMA, config.iqama)
      );
      expect(made).toContain(
        getNotificationChannelId(prayer, NOTIFICATION_TYPE.PRE_ATHAN, config.preAthan)
      );
    }
  });

  it("deletes the pre-Athan channels it made before", async () => {
    const stale = getNotificationChannelId("fajr", NOTIFICATION_TYPE.PRE_ATHAN, PRE_ATHAN);
    channels.mockResolvedValue([{ id: stale }]);

    await createNotificationChannels(settings(false));

    expect(deleted).toHaveBeenCalledWith(stale);
  });

  it("asks for new channels once a vibration setting changes, and only then", async () => {
    await createNotificationChannels(settings(true));
    channels.mockResolvedValue(created.mock.calls.map(([id, { sound }]) => ({ id, sound })));

    expect(await shouldUpdateChannels(settings(true))).toBe(false);
    expect(await shouldUpdateChannels(settings(false))).toBe(true);
  });
});
