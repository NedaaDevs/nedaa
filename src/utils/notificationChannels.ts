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
import type { CustomSound } from "@/types/customSound";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { isAthanSound } from "@/constants/sounds";

// Utils
import { getNotificationSound } from "@/utils/sound";
import { isCustomSoundKey, createChannelWithCustomSound } from "@/utils/customSoundManager";

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
 * Compare a channel's reported sound against the expected sound.
 *
 * expo-notifications' Android serializer returns "custom" for ALL non-default,
 * non-null sound URIs (see ExpoNotificationsChannelSerializer.java:60-70).
 * So we can't compare by exact filename — instead we compare by category:
 *   null    ↔ null     (silent)
 *   "default" ↔ "default"
 *   "custom"  ↔ any non-null, non-default string (bundled sound file)
 */
const channelSoundMatches = (
  existingSound: string | null | undefined,
  expectedSound: string | null
): boolean => {
  if (expectedSound === null) {
    return existingSound === null || existingSound === undefined;
  }
  if (expectedSound === "default") {
    return existingSound === "default";
  }
  // Expected is a specific sound file (e.g. "makkah_athan1.ogg").
  // The serializer will have reported it as "custom".
  return existingSound === "custom" || existingSound === expectedSound;
};

/**
 * Channel version — bump this to force fresh channel IDs for all users.
 * Android caches deleted channel settings and restores them when recreated
 * with the same ID, so the only way to fix a channel with wrong sound is
 * to use a brand-new ID.
 *
 * History:
 *   v2 — initial versioned IDs (silent/sound suffix)
 *   v3 — fix: channels may have been created with wrong sound due to
 *         fullAthanPlayback defaulting to true instead of false
 */
const CHANNEL_VERSION = 3;

/**
 * Generate a unique channel ID based on prayer, notification type, and sound
 */
const generateChannelId = (
  prayer: PrayerName,
  type: NotificationType,
  soundKey: string,
  silenced: boolean = false
): string => {
  // Use sound key to make channel unique per sound
  const sanitizedSoundKey = soundKey.replace(/[^a-zA-Z0-9]/g, "_");
  // Include explicit suffix so that toggling fullAthanPlayback creates a NEW channel ID,
  // bypassing Android's cache of deleted channel settings.
  const modeSuffix = silenced ? "silent" : "sound";
  return `${type}_${prayer}_${sanitizedSoundKey}_v${CHANNEL_VERSION}_${modeSuffix}`;
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
    [NOTIFICATION_TYPE.QADA]: "Qada",
  }[type];

  return `${prayerName} ${typeName} (${soundKey})`;
};

/**
 * Delete all managed notification channels so they can be recreated with correct settings.
 * Android channels have immutable sound — delete + recreate is the only way to update.
 * All user preferences live in the app store, so nothing is lost.
 */
const deleteAllManagedChannels = async (): Promise<void> => {
  try {
    const existingChannels = await Notifications.getNotificationChannelsAsync();

    for (const channel of existingChannels) {
      if (
        channel.id.startsWith("prayer_") ||
        channel.id.startsWith("iqama_") ||
        channel.id.startsWith("preathan_") ||
        channel.id.startsWith("athkar_") ||
        channel.id === "reminder"
      ) {
        await Notifications.deleteNotificationChannelAsync(channel.id);
      }
    }
  } catch (error) {
    console.error("[NotificationChannels] Failed to delete managed channels:", error);
  }
};

/**
 * IMPORTANT: Create notification channels with custom sounds for Android 8.0+
 */
export const createNotificationChannels = async (
  settings: NotificationSettings,
  customSounds: CustomSound[] = [],
  athkarSettings?: {
    morningNotification: AthkarNotificationSettings;
    eveningNotification: AthkarNotificationSettings;
  },
  fullAthanPlayback: boolean = false
): Promise<void> => {
  if (Platform.OS !== PlatformType.ANDROID) return;

  console.log("[NotificationChannels] Creating channels, fullAthanPlayback:", fullAthanPlayback);

  // Delete all managed channels and recreate from store settings.
  // Android channels have immutable sound — the only way to update is delete + recreate.
  // All user preferences live in the app store, so nothing is lost.
  await deleteAllManagedChannels();

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
      // When fullAthanPlayback is ON: athan sounds play via AthanService — set channel sound to null
      // When OFF: channel plays the athan sound directly as a notification sound
      const silenceChannel = fullAthanPlayback && isAthanSound(prayerConfig.sound);
      const resolvedSound = silenceChannel
        ? null
        : getNotificationSound(NOTIFICATION_TYPE.PRAYER, prayerConfig.sound);
      const channelId = generateChannelId(
        prayer,
        NOTIFICATION_TYPE.PRAYER,
        prayerConfig.sound,
        silenceChannel
      );

      channels.push({
        id: channelId,
        name: getChannelDisplayName(prayer, NOTIFICATION_TYPE.PRAYER, prayerConfig.sound),
        importance: Notifications.AndroidImportance.HIGH,
        sound: resolvedSound,
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

      // Check if this channel uses a custom sound
      const isCustom = channel.soundKey && isCustomSoundKey(channel.soundKey);

      if (isCustom) {
        const customSound = customSounds.find((s) => s.id === channel.soundKey);

        if (customSound) {
          await createChannelWithCustomSound(
            channel.id,
            channel.name,
            channel.soundKey!,
            customSounds,
            channel.importance,
            !!channel.vibrationPattern
          );
        } else {
          console.warn(
            `[NotificationChannels] Custom sound ${channel.soundKey} not found, skipping channel ${channel.id}`
          );
        }
      } else {
        // Handle bundled sound channels
        if (existingChannel && channelSoundMatches(existingChannel.sound, channel.sound)) {
          continue;
        }

        const soundToSet = channel.sound === null ? null : channel.sound || undefined;

        await Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          importance: channel.importance,
          sound: soundToSet,
          vibrationPattern: channel.vibrationPattern,
          showBadge: channel.showBadge,
        });
      }
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
  soundKey: string,
  silenced: boolean = false
): string => {
  return generateChannelId(prayer, type, soundKey, silenced);
};

/**
 * Check if channels need to be updated based on sound settings
 */
export const shouldUpdateChannels = async (
  settings: NotificationSettings,
  customSounds: CustomSound[] = [],
  athkarSettings?: {
    morningNotification: AthkarNotificationSettings;
    eveningNotification: AthkarNotificationSettings;
  },
  fullAthanPlayback: boolean = false
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
          // For prayer type, compute whether the channel is silenced (fullAthan ON + athan sound)
          const isSilenced =
            type === NOTIFICATION_TYPE.PRAYER && fullAthanPlayback && isAthanSound(config.sound);
          const channelId = generateChannelId(prayer, type, config.sound, isSilenced);
          requiredChannels.add(channelId);

          // Check if channel exists with correct sound
          const existingChannel = existingChannels.find((ch) => ch.id === channelId);

          // For custom sounds, always update to ensure correct URI is used
          if (isCustomSoundKey(config.sound)) {
            // Verify custom sound still exists
            const customSound = customSounds.find((s) => s.id === config.sound);
            if (!customSound) {
              console.warn(
                `[NotificationChannels] Custom sound ${config.sound} not found, will skip channel`
              );
              continue;
            }
            // Always recreate custom sound channels to ensure correct URI
            if (!existingChannel) {
              return true;
            }
            // For custom sounds, we can't easily verify the URI matches, so recreate if needed
            // The native module will handle updating the channel
            continue;
          }

          // For bundled sounds, check if the sound matches.
          // When fullAthanPlayback is ON, athan channels should be null (AthanService plays audio).
          // When OFF, athan channels should have the actual sound.
          const expectedSound =
            fullAthanPlayback && isAthanSound(config.sound)
              ? null
              : getNotificationSound(type, config.sound);
          if (!existingChannel || !channelSoundMatches(existingChannel.sound, expectedSound)) {
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

    // Reminder channel is always required
    requiredChannels.add("reminder");

    // Check if there are old channels that need cleanup
    const managedChannels = existingChannels.filter(
      (ch) =>
        ch.id.startsWith("prayer_") ||
        ch.id.startsWith("iqama_") ||
        ch.id.startsWith("preathan_") ||
        ch.id.startsWith("athkar_") ||
        ch.id === "reminder"
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
  if (Platform.OS !== PlatformType.ANDROID) return [];

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
  if (Platform.OS !== PlatformType.ANDROID) {
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
