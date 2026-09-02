import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Enums
import { PlatformType } from "@/enums/app";

// Types
import type { CustomSound, AddCustomSoundResult, CustomSoundUsageType } from "@/types/customSound";
import type { NotificationType, NotificationSettings } from "@/types/notification";
import type { AlarmType } from "@/types/alarm";
import { SUPPORTED_AUDIO_EXTENSIONS, CUSTOM_SOUND_KEY_PREFIX } from "@/types/customSound";

// Utils
import { getNotificationSound } from "@/utils/sound";
import { isCustomSoundKey as isCustomSoundKeyHelper } from "@/utils/customSoundHelpers";
import { toScheduledAlarmType } from "@/utils/alarmTypes";

// Stores
import { useAlarmSettingsStore } from "@/stores/alarmSettings";

import * as ExpoAlarm from "expo-alarm";

/**
 * Bundled sound that replaces a removed custom sound. `beep` is the only bundled sound
 * declared for every notification type, so it is valid wherever a custom sound was.
 */
export const CUSTOM_SOUND_REPLACEMENT = "beep";

const ALARM_TYPES: AlarmType[] = ["fajr", "friday"];

/**
 * Pick an audio file from the device
 */
export async function pickAudioFile(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  if (Platform.OS !== PlatformType.ANDROID) {
    throw new Error("Custom sounds are only supported on Android");
  }

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0];
  } catch (error) {
    console.error("[CustomSoundManager] Error picking file:", error);
    throw error;
  }
}

/**
 * Validate an audio file
 */
export function validateAudioFile(file: DocumentPicker.DocumentPickerAsset): {
  valid: boolean;
  error?: string;
} {
  // Check file extension
  const extension = getFileExtension(file.name);
  if (!SUPPORTED_AUDIO_EXTENSIONS.includes(extension as any)) {
    return {
      valid: false,
      error: `Unsupported file format. Supported formats: ${SUPPORTED_AUDIO_EXTENSIONS.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Get unique file identifier for duplicate detection
 */
export function getUniqueFileIdentifier(file: DocumentPicker.DocumentPickerAsset): string {
  return `${file.uri}_${file.size}`;
}

/**
 * Check if a file is a duplicate of an existing custom sound
 */
export function findDuplicateSound(
  file: DocumentPicker.DocumentPickerAsset,
  existingSounds: CustomSound[]
): CustomSound | null {
  return existingSounds.find((sound) => sound.fileName === file.name) || null;
}

/**
 * Add a custom notification sound
 */
export async function addCustomSound(
  file: DocumentPicker.DocumentPickerAsset,
  name: string,
  availableFor: NotificationType[],
  existingSounds: CustomSound[] = [],
  forceAdd: boolean = false
): Promise<AddCustomSoundResult> {
  if (Platform.OS !== PlatformType.ANDROID) {
    return {
      success: false,
      error: "Custom sounds are only supported on Android",
    };
  }

  // Check for duplicates unless force adding
  if (!forceAdd) {
    const duplicate = findDuplicateSound(file, existingSounds);
    if (duplicate) {
      return {
        success: false,
        error: "duplicate",
        duplicateSound: duplicate,
      };
    }
  }

  try {
    // Validate file
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error!,
      };
    }

    // Get local file path
    let filePath = file.uri;

    // If it's a content:// URI, copy to local file
    if (filePath.startsWith("content://")) {
      const tempFile = new File(
        Paths.cache,
        `temp_sound_${Date.now()}${getFileExtension(file.name)}`
      );
      await new File(filePath).copy(tempFile);
      filePath = tempFile.uri;
    }

    // Remove file:// prefix if present
    filePath = filePath.replace("file://", "");

    // Register with MediaStore (conditionally import on Android only)
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    // Registration deletes any existing row with the same title, so the id is part of
    // the title: two sounds the user names alike must not evict each other's file, or
    // an alarm already pointing at the first one loses its sound.
    const soundId = generateCustomSoundId();
    const soundTitle = `Nedaa_${name.replace(/[^a-zA-Z0-9]/g, "_")}_${soundId}`;
    const contentUri = await CustomNotificationSound.registerSoundFile(filePath, soundTitle);

    // Create custom sound object
    const customSound: CustomSound = {
      id: soundId,
      name,
      contentUri,
      fileName: file.name,
      fileSize: file.size || 0,
      fileIdentifier: getUniqueFileIdentifier(file),
      availableFor,
      dateAdded: new Date().toISOString(),
    };

    // Clean up temp file if we created one
    if (filePath.includes("temp_sound_")) {
      try {
        const tempFile = new File(filePath);
        if (tempFile.exists) tempFile.delete();
      } catch (error) {
        console.warn("[CustomSoundManager] Failed to delete temp file:", error);
      }
    }

    return {
      success: true,
      sound: customSound,
    };
  } catch (error) {
    console.error("[CustomSoundManager] Error adding custom sound:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add custom sound",
    };
  }
}

/**
 * Delete a custom sound from MediaStore
 */
export async function deleteCustomSoundFromMediaStore(contentUri: string): Promise<boolean> {
  if (Platform.OS !== PlatformType.ANDROID) {
    return false;
  }

  try {
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    const deleted = await CustomNotificationSound.deleteCustomSound(contentUri);
    console.log("[CustomSoundManager] Deleted from MediaStore:", deleted);
    return deleted;
  } catch (error) {
    console.error("[CustomSoundManager] Error deleting from MediaStore:", error);
    return false;
  }
}

/**
 * Validate if a custom sound URI is still valid
 */
export async function validateCustomSoundUri(contentUri: string): Promise<boolean> {
  if (Platform.OS !== PlatformType.ANDROID) {
    return false;
  }

  try {
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    return await CustomNotificationSound.isCustomSoundValid(contentUri);
  } catch (error) {
    console.error("[CustomSoundManager] Error validating URI:", error);
    return false;
  }
}

/**
 * Get the file extension from a filename
 */
function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
}

/**
 * Generate a unique ID for a custom sound
 */
function generateCustomSoundId(): string {
  return `${CUSTOM_SOUND_KEY_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get custom sound key for use in sound selectors
 * This makes custom sounds compatible with the existing sound system
 */
export function getCustomSoundKey(customSound: CustomSound): string {
  return customSound.id;
}

/**
 * Check if a sound key is a custom sound
 * Re-exported for backward compatibility
 */
export const isCustomSoundKey = isCustomSoundKeyHelper;

/**
 * Calculate total storage used by custom sounds
 */
export function calculateTotalStorage(customSounds: CustomSound[]): number {
  return customSounds.reduce((total, sound) => total + sound.fileSize, 0);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Create a notification channel with support for custom sounds
 * Uses the native module for custom sounds (content:// URIs)
 */
export const createChannelWithCustomSound = async (
  channelId: string,
  channelName: string,
  soundKey: string,
  customSounds: CustomSound[],
  importance: Notifications.AndroidImportance = Notifications.AndroidImportance.HIGH,
  vibration: boolean = true
): Promise<void> => {
  if (Platform.OS !== PlatformType.ANDROID) return;

  try {
    // Check if this is a custom sound
    if (isCustomSoundKey(soundKey)) {
      const customSound = customSounds.find((s) => s.id === soundKey);
      if (customSound) {
        // Use native module for custom sounds (conditionally imported on Android only)
        const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
        // Our custom native module expects Android's native importance level (0-5), not expo's enum (0-7)
        // Expo: HIGH=6 → Android: IMPORTANCE_HIGH=4
        const nativeImportance = 4; // HIGH importance (hardcoded for now)
        await CustomNotificationSound.createChannelWithCustomSound(
          channelId,
          channelName,
          customSound.contentUri,
          nativeImportance,
          vibration
        );
        console.log(`[CustomSoundManager] Created custom sound channel: ${channelId}`);
        return;
      }
    }

    // For bundled sounds, use expo-notifications
    const sound = getNotificationSound(soundKey as any, soundKey);
    await Notifications.setNotificationChannelAsync(channelId, {
      name: channelName,
      importance: importance,
      sound: sound || undefined,
      vibrationPattern: vibration ? [0, 250, 250, 250] : undefined,
      showBadge: true,
    });
    console.log(`[CustomSoundManager] Created bundled sound channel: ${channelId}`);
  } catch (error) {
    console.error(`[CustomSoundManager] Failed to create channel ${channelId}:`, error);
    throw error;
  }
};

/**
 * Build a Set of all used custom sound IDs
 */
export const buildUsedSoundsSet = (notificationSettings: NotificationSettings): Set<string> => {
  const usedSounds = new Set<string>();

  // Check default settings
  const defaults = [
    notificationSettings.defaults.prayer.sound,
    notificationSettings.defaults.iqama.sound,
    notificationSettings.defaults.preAthan.sound,
    notificationSettings.defaults.qada.sound,
  ];
  defaults.forEach((sound) => isCustomSoundKey(sound) && usedSounds.add(sound));

  // Check prayer-specific overrides
  Object.values(notificationSettings.overrides).forEach((prayerOverrides) => {
    const overrideSounds = [
      prayerOverrides.prayer?.sound,
      prayerOverrides.iqama?.sound,
      prayerOverrides.preAthan?.sound,
    ];
    overrideSounds.forEach((sound) => sound && isCustomSoundKey(sound) && usedSounds.add(sound));
  });

  return usedSounds;
};

/**
 * Check if a custom sound is being used in any notification settings
 */
export const isCustomSoundInUse = (
  soundId: string,
  notificationSettings: NotificationSettings
): boolean => {
  const usedSounds = buildUsedSoundsSet(notificationSettings);
  return usedSounds.has(soundId);
};

/**
 * Get all usage instances of a custom sound in notification settings
 */
export const getCustomSoundUsages = (
  soundId: string,
  notificationSettings: NotificationSettings
): { prayerId?: string; type: CustomSoundUsageType }[] => {
  const usages: { prayerId?: string; type: CustomSoundUsageType }[] = [];

  // Check default settings
  if (notificationSettings.defaults.prayer.sound === soundId) {
    usages.push({ type: "prayer" });
  }
  if (notificationSettings.defaults.iqama.sound === soundId) {
    usages.push({ type: "iqama" });
  }
  if (notificationSettings.defaults.preAthan.sound === soundId) {
    usages.push({ type: "preAthan" });
  }
  // Qada has no per-prayer overrides; it is a defaults-only notification type.
  if (notificationSettings.defaults.qada.sound === soundId) {
    usages.push({ type: "qada" });
  }

  // Check prayer-specific overrides
  for (const prayerId in notificationSettings.overrides) {
    const prayerOverrides = notificationSettings.overrides[prayerId];
    if (prayerOverrides.prayer?.sound === soundId) {
      usages.push({ prayerId, type: "prayer" });
    }
    if (prayerOverrides.iqama?.sound === soundId) {
      usages.push({ prayerId, type: "iqama" });
    }
    if (prayerOverrides.preAthan?.sound === soundId) {
      usages.push({ prayerId, type: "preAthan" });
    }
  }

  return usages;
};

/**
 * Alarm types whose selected sound is this content:// URI. Alarms persist the URI
 * itself rather than a custom sound id, so the lookup is by URI.
 */
export const getAlarmUsagesForUri = async (contentUri: string): Promise<AlarmType[] | null> => {
  const found: AlarmType[] = [];

  for (const type of ALARM_TYPES) {
    // The native database is what the alarm reads when it fires, and a settings sync
    // that failed earlier leaves it holding a URI the JS store never learned about.
    // An unreadable database means unknown, not unused: answering from the store could
    // delete a file an alarm still points at, so the caller is told to stop instead.
    const native = await ExpoAlarm.getAlarmSettings(toScheduledAlarmType(type));
    if (!native) return null;
    if (native.sound === contentUri) found.push(type);
  }

  return found;
};

/**
 * Realigns the JS store with what the native database actually holds. Used after a
 * partly-applied change, so the two never describe different sounds.
 */
const reconcileAlarmStoreWithNative = async (): Promise<void> => {
  const store = useAlarmSettingsStore.getState();
  for (const type of ALARM_TYPES) {
    const native = await ExpoAlarm.getAlarmSettings(toScheduledAlarmType(type));
    if (native && native.sound !== store[type].sound) {
      store.setSound(type, native.sound);
    }
  }
};

/**
 * Repoints every alarm using this URI onto a bundled fallback, natively first and then
 * in the JS store. Returns false when a native write fails, which means the file must
 * be kept: an alarm left pointing at a deleted URI falls through to another sound
 * without telling the user.
 */
export const releaseCustomSoundFromAlarms = async (
  contentUri: string,
  fallbackSound: string = CUSTOM_SOUND_REPLACEMENT
): Promise<boolean> => {
  const affected = await getAlarmUsagesForUri(contentUri);
  // Null means the native database could not be read, so nothing may be released.
  if (affected === null) return false;
  if (affected.length === 0) return true;

  const moved: AlarmType[] = [];

  for (const alarmType of affected) {
    // setAlarmSettings resolves false rather than throwing, so the result has to be read.
    const written = await ExpoAlarm.setAlarmSettings(toScheduledAlarmType(alarmType), {
      sound: fallbackSound,
    });
    if (!written) {
      // One alarm moved and another refused leaves the user with a sound they never
      // chose on an alarm they are still keeping, so undo the ones already written.
      for (const done of moved) {
        await ExpoAlarm.setAlarmSettings(toScheduledAlarmType(done), { sound: contentUri });
      }
      // A rollback can fail too; adopting the real native values keeps the store honest
      // about what will play rather than showing a sound that is no longer selected.
      await reconcileAlarmStoreWithNative();
      return false;
    }
    moved.push(alarmType);
  }

  // The JS store follows only once every native write has landed, so a partial failure
  // never leaves the two disagreeing about what will actually play.
  const store = useAlarmSettingsStore.getState();
  for (const alarmType of moved) {
    store.setSound(alarmType, fallbackSound);
  }

  return true;
};

/**
 * Replace a custom sound with a default sound in all notification settings
 */
export const replaceCustomSoundInSettings = (
  oldSoundId: string,
  newSoundId: string = CUSTOM_SOUND_REPLACEMENT,
  notificationSettings: NotificationSettings
): NotificationSettings => {
  const newSettings = JSON.parse(JSON.stringify(notificationSettings)); // Deep clone

  // Replace in default settings
  if (newSettings.defaults.prayer.sound === oldSoundId) {
    newSettings.defaults.prayer.sound = newSoundId;
  }
  if (newSettings.defaults.iqama.sound === oldSoundId) {
    newSettings.defaults.iqama.sound = newSoundId;
  }
  if (newSettings.defaults.preAthan.sound === oldSoundId) {
    newSettings.defaults.preAthan.sound = newSoundId;
  }
  if (newSettings.defaults.qada.sound === oldSoundId) {
    newSettings.defaults.qada.sound = newSoundId;
  }

  // Replace in prayer-specific overrides
  for (const prayerId in newSettings.overrides) {
    const prayerOverrides = newSettings.overrides[prayerId];
    if (prayerOverrides.prayer?.sound === oldSoundId) {
      prayerOverrides.prayer.sound = newSoundId;
    }
    if (prayerOverrides.iqama?.sound === oldSoundId) {
      prayerOverrides.iqama.sound = newSoundId;
    }
    if (prayerOverrides.preAthan?.sound === oldSoundId) {
      prayerOverrides.preAthan.sound = newSoundId;
    }
  }

  return newSettings;
};
