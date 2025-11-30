import { Platform } from "react-native";

// Enums
import { PlatformType } from "@/enums/app";

// Types
import type { SystemAlarmSound } from "@/types/customSound";
import { SYSTEM_ALARM_SOUND_KEY_PREFIX } from "@/types/customSound";

/**
 * Get all system alarm sounds from the device
 * Only available on Android
 */
export async function getSystemAlarmSounds(): Promise<SystemAlarmSound[]> {
  if (Platform.OS !== PlatformType.ANDROID) {
    return [];
  }

  try {
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    const sounds = await CustomNotificationSound.getSystemAlarmSounds();
    return sounds;
  } catch (error) {
    console.error("[SystemAlarmSounds] Error getting system alarm sounds:", error);
    return [];
  }
}

/**
 * Get the default system alarm sound URI
 * Only available on Android
 */
export async function getDefaultAlarmSoundUri(): Promise<string | null> {
  if (Platform.OS !== PlatformType.ANDROID) {
    return null;
  }

  try {
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    return await CustomNotificationSound.getDefaultAlarmSound();
  } catch (error) {
    console.error("[SystemAlarmSounds] Error getting default alarm sound:", error);
    return null;
  }
}

/**
 * Check if a sound key is a system alarm sound
 */
export function isSystemAlarmSoundKey(key: string): boolean {
  return key.startsWith(SYSTEM_ALARM_SOUND_KEY_PREFIX);
}

/**
 * Get the URI for a system alarm sound by its key
 */
export async function getSystemAlarmSoundUri(key: string): Promise<string | null> {
  if (!isSystemAlarmSoundKey(key)) {
    return null;
  }

  const sounds = await getSystemAlarmSounds();
  const sound = sounds.find((s) => s.id === key);
  return sound?.uri ?? null;
}

/**
 * Find a system alarm sound by its URI
 */
export async function findSystemAlarmSoundByUri(uri: string): Promise<SystemAlarmSound | null> {
  const sounds = await getSystemAlarmSounds();
  return sounds.find((s) => s.uri === uri) ?? null;
}
