import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { NOTIFICATION_CHANNEL_ID, NOTIFICATION_TYPE } from "@/constants/Notification";
import { PRAYER_ID } from "@/constants/Prayer";
import type { NotificationSettings } from "@/types/notification";
import {
  createNotificationChannels,
  getActiveChannelMappings,
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

  it("deletes the pre-Athan channels it made before", async () => {
    const stale = getNotificationChannelId("fajr", NOTIFICATION_TYPE.PRE_ATHAN, PRE_ATHAN);
    channels.mockResolvedValue([{ id: stale }]);

    await createNotificationChannels(settings(false));

    expect(deleted).toHaveBeenCalledWith(stale);
  });

  it.each(Object.values(NOTIFICATION_CHANNEL_ID))("deletes the fixed channel %s", async (id) => {
    channels.mockResolvedValue([{ id }]);

    await createNotificationChannels(settings(true));

    expect(deleted).toHaveBeenCalledWith(id);
  });

  it("asks for new channels once a vibration setting changes, and only then", async () => {
    await createNotificationChannels(settings(true));
    channels.mockResolvedValue(created.mock.calls.map(([id, { sound }]) => ({ id, sound })));

    expect(await shouldUpdateChannels(settings(true))).toBe(false);
    expect(await shouldUpdateChannels(settings(false))).toBe(true);
  });

  it("reads each prayer channel back to its type, prayer and sound", async () => {
    await createNotificationChannels(settings(true));
    channels.mockResolvedValue(created.mock.calls.map(([id]) => ({ id })));

    const mappings = await getActiveChannelMappings();

    expect(mappings).toContainEqual(
      expect.objectContaining({
        prayerName: PRAYER_ID.FAJR,
        notificationType: NOTIFICATION_TYPE.PRE_ATHAN,
        soundKey: PRE_ATHAN.sound,
      })
    );
    expect(mappings).toContainEqual(
      expect.objectContaining({
        prayerName: PRAYER_ID.FAJR,
        notificationType: NOTIFICATION_TYPE.PRAYER,
        soundKey: settings(true).defaults.prayer.sound,
      })
    );
  });
});
