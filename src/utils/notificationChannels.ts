import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Types
import {
  AthkarNotificationSettings,
  getEffectiveConfig,
  type NotificationSettings,
  NotificationType,
} from "@/types/notification";
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
  prayerName?: PrayerName;
  notificationType?: NotificationType;
  soundKey?: string;
};

type ChannelMapping = {
  channelId: string;
  prayerName: PrayerName;
  notificationType: NotificationType;
  soundKey: string;
};

/**
 * Generate a unique channel ID based on prayer, notification type, and sound
 */
const generateChannelId = (
  prayer: PrayerName,
  type: NotificationType,
  soundKey: string
): string => {
  // Use sound key to make channel unique per sound
  const sanitizedSoundKey = soundKey.replace(/[^a-zA-Z0-9]/g, "_");
  return `${type}_${prayer}_${sanitizedSoundKey}`;
};

/**
 * Get the display name for a channel
 */
const getChannelDisplayName = (
  prayer: PrayerName,
  type: NotificationType,
  soundKey: string
): string => {
  const prayerName = prayer.charAt(0).toUpperCase() + prayer.slice(1);
  const typeName = {
    [NOTIFICATION_TYPE.PRAYER]: "Prayer",
    [NOTIFICATION_TYPE.IQAMA]: "Iqama",
    [NOTIFICATION_TYPE.PRE_ATHAN]: "Pre-Athan",
    [NOTIFICATION_TYPE.ATHKAR]: "Athkar",
  }[type];

  return `${prayerName} ${typeName} (${soundKey})`;
};

/**
 * Clean up old notification channels that are no longer needed
 */
export const cleanupOldChannels = async (
  currentSettings: NotificationSettings,
  athkarSettings?: {
    morningNotification: AthkarNotificationSettings;
    eveningNotification: AthkarNotificationSettings;
  }
): Promise<void> => {
  if (Platform.OS !== "android") return;

  try {
    const existingChannels = await Notifications.getNotificationChannelsAsync();
    const prayers: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    const currentChannelIds = new Set<string>();

    // Build set of current channel IDs that should exist
    for (const prayer of prayers) {
      const configs = [
        {
          type: NOTIFICATION_TYPE.PRAYER,
          config: getEffectiveConfig(
            prayer,
            NOTIFICATION_TYPE.PRAYER,
            currentSettings.defaults,
            currentSettings.overrides
          ),
        },
        {
          type: NOTIFICATION_TYPE.IQAMA,
          config: getEffectiveConfig(
            prayer,
            NOTIFICATION_TYPE.IQAMA,
            currentSettings.defaults,
            currentSettings.overrides
          ),
        },
        {
          type: NOTIFICATION_TYPE.PRE_ATHAN,
          config: getEffectiveConfig(
            prayer,
            NOTIFICATION_TYPE.PRE_ATHAN,
            currentSettings.defaults,
            currentSettings.overrides
          ),
        },
      ];

      for (const { type, config } of configs) {
        if (config.enabled) {
          const channelId = generateChannelId(prayer, type, config.sound);
          currentChannelIds.add(channelId);
        }
      }
    }

    // Add reminder channel
    currentChannelIds.add("reminder");
    // Add Athkar channel IDs if enabled
    if (athkarSettings) {
      if (athkarSettings.morningNotification.enabled) {
        currentChannelIds.add("athkar_morning");
      }
      if (athkarSettings.eveningNotification.enabled) {
        currentChannelIds.add("athkar_evening");
      }
    }

    // Delete channels that are no longer needed
    for (const channel of existingChannels) {
      // Only delete channels we manage (prayer-related and athkar channels)
      if (
        (channel.id.startsWith("prayer_") ||
          channel.id.startsWith("iqama_") ||
          channel.id.startsWith("preathan_") ||
          channel.id.startsWith("athkar_")) &&
        !currentChannelIds.has(channel.id)
      ) {
        try {
          await Notifications.deleteNotificationChannelAsync(channel.id);
          console.log(`[NotificationChannels] Deleted old channel: ${channel.id}`);
        } catch (error) {
          console.error(`[NotificationChannels] Failed to delete channel ${channel.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("[NotificationChannels] Failed to cleanup old channels:", error);
  }
};

/**
 * IMPORTANT: Create notification channels with custom sounds for Android 8.0+
 */
export const createNotificationChannels = async (
  settings: NotificationSettings,
  athkarSettings?: {
    morningNotification: AthkarNotificationSettings;
    eveningNotification: AthkarNotificationSettings;
  }
): Promise<void> => {
  if (Platform.OS !== "android") return;

  console.log("[NotificationChannels] Creating notification channels with custom sounds...");

  // First, cleanup old channels that are no longer needed
  await cleanupOldChannels(settings, athkarSettings);

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
        id: generateChannelId(prayer, NOTIFICATION_TYPE.PRAYER, prayerConfig.sound),
        name: getChannelDisplayName(prayer, NOTIFICATION_TYPE.PRAYER, prayerConfig.sound),
        importance: Notifications.AndroidImportance.HIGH,
        sound: getNotificationSound(NOTIFICATION_TYPE.PRAYER, prayerConfig.sound),
        vibrationPattern: prayerConfig.vibration ? [0, 250, 250, 250] : undefined,
        showBadge: true,
        prayerName: prayer,
        notificationType: NOTIFICATION_TYPE.PRAYER,
        soundKey: prayerConfig.sound,
      });
    }

    // Iqama notification channel
    if (iqamaConfig.enabled) {
      channels.push({
        id: generateChannelId(prayer, NOTIFICATION_TYPE.IQAMA, iqamaConfig.sound),
        name: getChannelDisplayName(prayer, NOTIFICATION_TYPE.IQAMA, iqamaConfig.sound),
        importance: Notifications.AndroidImportance.HIGH,
        sound: getNotificationSound(NOTIFICATION_TYPE.IQAMA, iqamaConfig.sound),
        vibrationPattern: iqamaConfig.vibration ? [0, 250, 250, 250] : undefined,
        showBadge: true,
        prayerName: prayer,
        notificationType: NOTIFICATION_TYPE.IQAMA,
        soundKey: iqamaConfig.sound,
      });
    }

    // Pre-Athan notification channel
    if (preAthanConfig.enabled) {
      channels.push({
        id: generateChannelId(prayer, NOTIFICATION_TYPE.PRE_ATHAN, preAthanConfig.sound),
        name: getChannelDisplayName(prayer, NOTIFICATION_TYPE.PRE_ATHAN, preAthanConfig.sound),
        importance: Notifications.AndroidImportance.HIGH,
        sound: getNotificationSound(NOTIFICATION_TYPE.PRE_ATHAN, preAthanConfig.sound),
        vibrationPattern: preAthanConfig.vibration ? [0, 100, 100, 100] : undefined,
        showBadge: true,
        prayerName: prayer,
        notificationType: NOTIFICATION_TYPE.PRE_ATHAN,
        soundKey: preAthanConfig.sound,
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

  // Add Athkar channels if settings provided
  if (athkarSettings) {
    if (athkarSettings.morningNotification.enabled) {
      channels.push({
        id: "athkar_morning",
        name: "Morning Athkar",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        showBadge: true,
      });
    }

    if (athkarSettings.eveningNotification.enabled) {
      channels.push({
        id: "athkar_evening",
        name: "Evening Athkar",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        showBadge: true,
      });
    }
  }

  // Create all channels
  for (const channel of channels) {
    try {
      // Check if channel already exists with same configuration
      const existingChannels = await Notifications.getNotificationChannelsAsync();
      const existingChannel = existingChannels.find((ch) => ch.id === channel.id);

      if (existingChannel && existingChannel.sound === channel.sound) {
        console.log(
          `[NotificationChannels] Channel ${channel.id} already exists with correct sound`
        );
        continue;
      }

      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: channel.importance,
        sound: channel.sound || undefined, // Convert null to undefined for expo-notifications
        vibrationPattern: channel.vibrationPattern,
        showBadge: channel.showBadge,
      });

      console.log(
        `[NotificationChannels] Created/Updated channel: ${channel.id} with sound: ${channel.sound}`
      );
    } catch (error) {
      console.error(`[NotificationChannels] Failed to create channel ${channel.id}:`, error);
    }
  }
};

/**
 * Get the correct channel ID for a notification
 */
export const getNotificationChannelId = (
  prayer: PrayerName,
  type: NotificationType,
  soundKey: string
): string => {
  return generateChannelId(prayer, type, soundKey);
};

/**
 * Check if channels need to be updated based on sound settings
 */
export const shouldUpdateChannels = async (
  settings: NotificationSettings,
  athkarSettings?: {
    morningNotification: AthkarNotificationSettings;
    eveningNotification: AthkarNotificationSettings;
  }
): Promise<boolean> => {
  if (Platform.OS !== PlatformType.ANDROID) return false;

  try {
    const existingChannels = await Notifications.getNotificationChannelsAsync();
    const prayers: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    const requiredChannels = new Set<string>();

    // Build set of required channel IDs
    for (const prayer of prayers) {
      const configs = [
        {
          type: NOTIFICATION_TYPE.PRAYER,
          config: getEffectiveConfig(
            prayer,
            NOTIFICATION_TYPE.PRAYER,
            settings.defaults,
            settings.overrides
          ),
        },
        {
          type: NOTIFICATION_TYPE.IQAMA,
          config: getEffectiveConfig(
            prayer,
            NOTIFICATION_TYPE.IQAMA,
            settings.defaults,
            settings.overrides
          ),
        },
        {
          type: NOTIFICATION_TYPE.PRE_ATHAN,
          config: getEffectiveConfig(
            prayer,
            NOTIFICATION_TYPE.PRE_ATHAN,
            settings.defaults,
            settings.overrides
          ),
        },
      ];

      for (const { type, config } of configs) {
        if (config.enabled) {
          const channelId = generateChannelId(prayer, type, config.sound);
          requiredChannels.add(channelId);

          // Check if channel exists with correct sound
          const existingChannel = existingChannels.find((ch) => ch.id === channelId);
          const expectedSound = getNotificationSound(type, config.sound);

          if (!existingChannel || existingChannel.sound !== expectedSound) {
            return true;
          }
        }
      }
    }

    // Check Athkar channels if settings provided
    if (athkarSettings) {
      if (athkarSettings.morningNotification.enabled) {
        requiredChannels.add("athkar_morning");
        const existingChannel = existingChannels.find((ch) => ch.id === "athkar_morning");
        if (!existingChannel || existingChannel.sound !== "default") {
          return true;
        }
      }

      if (athkarSettings.eveningNotification.enabled) {
        requiredChannels.add("athkar_evening");
        const existingChannel = existingChannels.find((ch) => ch.id === "athkar_evening");
        if (!existingChannel || existingChannel.sound !== "default") {
          return true;
        }
      }
    }

    // Check if there are old channels that need cleanup
    const managedChannels = existingChannels.filter(
      (ch) =>
        ch.id.startsWith("prayer_") ||
        ch.id.startsWith("iqama_") ||
        ch.id.startsWith("preathan_") ||
        ch.id.startsWith("athkar_")
    );

    for (const channel of managedChannels) {
      if (!requiredChannels.has(channel.id)) {
        return true; // Need to cleanup old channels
      }
    }

    return false;
  } catch (error) {
    console.error("[NotificationChannels] Error checking if channels need update:", error);
    return true; // Assume update needed on error
  }
};

/**
 * Get all active channel mappings for debugging/monitoring
 */
export const getActiveChannelMappings = async (): Promise<ChannelMapping[]> => {
  if (Platform.OS !== "android") return [];

  try {
    const channels = await Notifications.getNotificationChannelsAsync();
    const mappings: ChannelMapping[] = [];

    for (const channel of channels) {
      // Parse our managed channels
      const match = channel.id.match(/^(prayer|iqama|preathan)_([^_]+)_(.+)$/);
      if (match) {
        const [, type, prayer, soundKey] = match;
        mappings.push({
          channelId: channel.id,
          prayerName: prayer as PrayerName,
          notificationType: type as NotificationType,
          soundKey: soundKey.replace(/_/g, " "), // Convert back from sanitized form
        });
      }
    }

    return mappings;
  } catch (error) {
    console.error("[NotificationChannels] Error getting active channel mappings:", error);
    return [];
  }
};

/**
 * Debug function to log all channel information
 */
export const debugChannelInfo = async (): Promise<void> => {
  if (Platform.OS !== "android") {
    console.log("[NotificationChannels] Debug: Not on Android platform");
    return;
  }

  try {
    const channels = await Notifications.getNotificationChannelsAsync();
    console.log(`[NotificationChannels] Debug: Found ${channels.length} total channels`);

    const managedChannels = channels.filter(
      (ch) =>
        ch.id.startsWith("prayer_") ||
        ch.id.startsWith("iqama_") ||
        ch.id.startsWith("preathan_") ||
        ch.id === "reminder"
    );

    console.log(`[NotificationChannels] Debug: Found ${managedChannels.length} managed channels`);

    for (const channel of managedChannels) {
      console.log(
        `[NotificationChannels] Debug: Channel '${channel.id}' - Sound: '${channel.sound}' - Name: '${channel.name}'`
      );
    }

    const mappings = await getActiveChannelMappings();
    console.log(`[NotificationChannels] Debug: Active mappings:`, mappings);
  } catch (error) {
    console.error("[NotificationChannels] Debug: Error getting channel info:", error);
  }
};
