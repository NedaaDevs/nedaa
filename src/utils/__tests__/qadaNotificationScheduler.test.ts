import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { NOTIFICATION_CHANNEL_ID } from "@/constants/Notification";
import type { QadaSoundKey } from "@/constants/sounds";
import type { QadaNotificationConfig } from "@/types/notification";
import { setupQadaNotificationChannel } from "@/utils/qadaNotificationScheduler";

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  getNotificationChannelsAsync: jest.fn(),
  deleteNotificationChannelAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}));
jest.mock("@/utils/notifications", () => ({
  scheduleNotification: jest.fn(),
  scheduleRecurringNotification: jest.fn(),
}));
jest.mock("@/utils/customSoundManager", () => ({ createChannelWithCustomSound: jest.fn() }));
jest.mock("@/stores/location", () => ({ __esModule: true, default: { getState: jest.fn() } }));
jest.mock("@/stores/app", () => ({ useAppStore: { getState: jest.fn() } }));

type Channel = { id?: string };

const channels = Notifications.getNotificationChannelsAsync as unknown as jest.Mock<
  Promise<Channel[]>
>;
const deleted = Notifications.deleteNotificationChannelAsync as jest.Mock;

const SOUND: QadaSoundKey = "tasbih";
const SYSTEM_SOUND: QadaNotificationConfig["sound"] = "default";

describe("qada notification channel", () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "android");
    channels.mockResolvedValue([]);
  });

  // A channel's sound and vibration are fixed, so each change makes a new id.
  it("deletes the qada channels a previous sound or vibration made", async () => {
    const stale = await setupQadaNotificationChannel(SOUND, [], false);
    const staleDefault = await setupQadaNotificationChannel(SYSTEM_SOUND, [], true);
    channels.mockResolvedValue([{ id: stale }, { id: staleDefault }]);
    deleted.mockClear();

    const current = await setupQadaNotificationChannel(SOUND, [], true);

    expect(deleted).toHaveBeenCalledWith(stale);
    expect(deleted).toHaveBeenCalledWith(staleDefault);
    expect(deleted).not.toHaveBeenCalledWith(current);
  });

  it("leaves every other channel alone", async () => {
    const current = await setupQadaNotificationChannel(SOUND, [], true);
    channels.mockResolvedValue([{ id: NOTIFICATION_CHANNEL_ID.REMINDER }, { id: current }]);
    deleted.mockClear();

    await setupQadaNotificationChannel(SOUND, [], true);

    expect(deleted).not.toHaveBeenCalled();
  });
});
