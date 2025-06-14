import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Types
import { getEffectiveConfig, type NotificationSettings } from "@/types/notification";
import { PrayerName } from "@/types/prayerTimes";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

// Utils
import { getNotificationSound } from "@/utils/sound";

// Enums
import { PlatformType } from "@/enums/app";

type ChannelConfig = {
  id: string;
  name: string;
  importance: Notifications.AndroidImportance;
  sound: string | null;
  vibrationPattern?: number[];
  showBadge?: boolean;
};

/**
 * IMPORTANT: Create notification channels with custom sounds for Android 8.0+
 */
export const createNotificationChannels = async (settings: NotificationSettings): Promise<void> => {
  if (Platform.OS !== "android") return;

  console.log("[NotificationChannels] Creating notification channels with custom sounds...");

  const prayers: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  const channels: ChannelConfig[] = [];

  // Create channels for each prayer and notification type combination
  for (const prayer of prayers) {
    // Get effective configs for this prayer
    const prayerConfig = getEffectiveConfig(
      prayer,
      NOTIFICATION_TYPE.PRAYER,
      settings.defaults,
      settings.overrides
    );
    const iqamaConfig = getEffectiveConfig(
      prayer,
      NOTIFICATION_TYPE.IQAMA,
      settings.defaults,
      settings.overrides
    );
    const preAthanConfig = getEffectiveConfig(
      prayer,
      NOTIFICATION_TYPE.PRE_ATHAN,
      settings.defaults,
      settings.overrides
    );

    // Prayer notification channel
    if (prayerConfig.enabled) {
      channels.push({
        id: `prayer_${prayer}`,
        name: `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} Prayer`,
        importance: Notifications.AndroidImportance.HIGH,
        sound: getNotificationSound(NOTIFICATION_TYPE.PRAYER, prayerConfig.sound),
        vibrationPattern: prayerConfig.vibration ? [0, 250, 250, 250] : undefined,
        showBadge: true,
      });
    }

    // Iqama notification channel
    if (iqamaConfig.enabled) {
      channels.push({
        id: `iqama_${prayer}`,
        name: `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} Iqama`,
        importance: Notifications.AndroidImportance.HIGH,
        sound: getNotificationSound(NOTIFICATION_TYPE.IQAMA, iqamaConfig.sound),
        vibrationPattern: iqamaConfig.vibration ? [0, 250, 250, 250] : undefined,
        showBadge: true,
      });
    }

    // Pre-Athan notification channel
    if (preAthanConfig.enabled) {
      channels.push({
        id: `preathan_${prayer}`,
        name: `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} Pre-Athan`,
        importance: Notifications.AndroidImportance.HIGH,
        sound: getNotificationSound(NOTIFICATION_TYPE.PRE_ATHAN, preAthanConfig.sound),
        vibrationPattern: preAthanConfig.vibration ? [0, 100, 100, 100] : undefined,
        showBadge: true,
      });
    }
  }

  // Create reminder channel
  channels.push({
    id: "reminder",
    name: "Prayer Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    showBadge: true,
  });

  // Create all channels
  for (const channel of channels) {
    try {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: channel.importance,
        sound: channel.sound || undefined, // Convert null to undefined for expo-notifications
        vibrationPattern: channel.vibrationPattern,
        showBadge: channel.showBadge,
      });

      console.log(
        `[NotificationChannels] Created channel: ${channel.id} with sound: ${channel.sound}`
      );
    } catch (error) {
      console.error(`[NotificationChannels] Failed to create channel ${channel.id}:`, error);
    }
  }
};

/**
 * Check if channels need to be updated based on sound settings
 */
export const shouldUpdateChannels = async (settings: NotificationSettings): Promise<boolean> => {
  if (Platform.OS !== PlatformType.ANDROID) return false;

  const existingChannels = await Notifications.getNotificationChannelsAsync();
  const prayers: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

  // Check if all required channels exist with correct sounds
  for (const prayer of prayers) {
    const prayerConfig = getEffectiveConfig(
      prayer,
      NOTIFICATION_TYPE.PRAYER,
      settings.defaults,
      settings.overrides
    );

    if (prayerConfig.enabled) {
      const channelId = `prayer_${prayer}`;
      const existingChannel = existingChannels.find((ch) => ch.id === channelId);
      const expectedSound = getNotificationSound(NOTIFICATION_TYPE.PRAYER, prayerConfig.sound);

      if (!existingChannel || existingChannel.sound !== expectedSound) {
        return true;
      }
    }
  }

  return false;
};
