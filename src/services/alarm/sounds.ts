import { Platform } from "react-native";

// Types
import type { PrayerSoundKey } from "@/constants/sounds";
import type { AlarmSoundKey } from "@/types/alarm";
import { SYSTEM_ALARM_SOUND_KEY_PREFIX } from "@/types/customSound";

// Constants
import { SOUND_ASSETS } from "@/constants/sounds";

// Cache for system alarm sounds to avoid repeated lookups
let systemAlarmSoundsCache: Map<string, string> | null = null;

/**
 * Special key for system default alarm sound
 */
export const DEFAULT_SYSTEM_SOUND_KEY = "default";

/**
 * Maps sound keys to iOS AlarmKit sound names.
 * These must match the .caf files in the iOS bundle.
 * Keys are camelCase (TypeScript), values are snake_case (iOS bundle filenames without extension).
 */
const SOUND_MAP_IOS: Partial<Record<PrayerSoundKey, string>> = {
  makkahAthan1: "makkah_athan1",
  medinaAthan: "medina_athan",
  yasserAldosari: "yasser_aldosari",
  athan2: "athan2",
  athan3: "athan3",
  iqama1: "iqama1",
  takbir: "takbir",
  tasbih: "tasbih",
  knock: "knock",
  beep: "beep",
};

/**
 * Check if a sound key is a system alarm sound
 */
export function isSystemAlarmSoundKey(key: string): boolean {
  return key.startsWith(SYSTEM_ALARM_SOUND_KEY_PREFIX);
}

/**
 * Load and cache system alarm sounds
 */
async function loadSystemAlarmSoundsCache(): Promise<Map<string, string>> {
  if (systemAlarmSoundsCache !== null) {
    return systemAlarmSoundsCache;
  }

  systemAlarmSoundsCache = new Map();

  if (Platform.OS !== "android") {
    return systemAlarmSoundsCache;
  }

  try {
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    const sounds = await CustomNotificationSound.getSystemAlarmSounds();

    for (const sound of sounds) {
      systemAlarmSoundsCache.set(sound.id, sound.uri);
    }
  } catch (error) {
    console.error("[AlarmSounds] Error loading system alarm sounds:", error);
  }

  return systemAlarmSoundsCache;
}

/**
 * Clear the system alarm sounds cache (useful for refreshing)
 */
export function clearSystemAlarmSoundsCache(): void {
  systemAlarmSoundsCache = null;
}

/**
 * Get the sound URI/name for the current platform.
 *
 * - Android: Returns a resource URI like "android.resource://dev.nedaa.android/raw/makkah_athan1"
 *           or a content:// URI for system alarm sounds
 * - iOS: Returns the sound filename without extension (e.g., "makkah_athan1")
 *
 * @param soundKey - The sound key (bundled sound or system alarm sound)
 * @returns Sound URI/name for the platform, or undefined if not found
 */
export function getSoundForPlatform(soundKey: PrayerSoundKey): string | undefined {
  if (Platform.OS === "android") {
    return getAndroidSoundUri(soundKey);
  } else if (Platform.OS === "ios") {
    return getIOSSoundName(soundKey);
  }
  return undefined;
}

/**
 * Get the sound URI for an alarm sound key (async version that supports system sounds)
 *
 * @param soundKey - The sound key (bundled, system alarm, "default", or custom)
 * @returns Sound URI for Android, or undefined to use system default
 */
export async function getAlarmSoundUri(soundKey: AlarmSoundKey): Promise<string | undefined> {
  if (Platform.OS !== "android") {
    return undefined;
  }

  // "default" means use system default sound
  if (isDefaultSoundKey(soundKey)) {
    return undefined;
  }

  // Check if it's a system alarm sound
  if (isSystemAlarmSoundKey(soundKey)) {
    const cache = await loadSystemAlarmSoundsCache();
    return cache.get(soundKey);
  }

  // Otherwise, it's a bundled sound
  return getAndroidSoundUri(soundKey as PrayerSoundKey);
}

/**
 * Get Android resource URI for a bundled sound.
 */
export function getAndroidSoundUri(soundKey: PrayerSoundKey): string | undefined {
  const asset = SOUND_ASSETS[soundKey];
  if (!asset?.notificationSound) return undefined;
  // Remove extension for Android resource URI
  const soundName = asset.notificationSound.replace(/\.(mp3|wav|ogg)$/i, "");
  return `android.resource://dev.nedaa.android/raw/${soundName}`;
}

/**
 * Check if a sound key is the default system sound
 */
export function isDefaultSoundKey(key: string): boolean {
  return key === DEFAULT_SYSTEM_SOUND_KEY;
}

/**
 * Get iOS sound filename for AlarmKit.
 * Returns undefined for system default or Android system sounds (uses iOS default).
 *
 * @param soundKey - The sound key (bundled sound, system alarm sound, or "default")
 * @returns Sound filename without extension for iOS bundle, or undefined to use system default
 */
export function getIOSSoundName(soundKey: AlarmSoundKey | "default"): string | undefined {
  // "default" means use system default sound
  if (isDefaultSoundKey(soundKey)) {
    return undefined;
  }

  // System alarm sounds are Android-only, return undefined to use iOS default
  if (isSystemAlarmSoundKey(soundKey)) {
    return undefined;
  }

  return SOUND_MAP_IOS[soundKey as PrayerSoundKey];
}

/**
 * Default sound key to use when none is specified.
 */
export const DEFAULT_ALARM_SOUND: PrayerSoundKey = "makkah_athan1";
