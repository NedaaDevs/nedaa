import { Platform } from "react-native";

// Types
import type { PrayerSoundKey } from "@/constants/sounds";

// Constants
import { SOUND_ASSETS } from "@/constants/sounds";

/**
 * Maps sound keys to iOS AlarmKit sound names.
 * These must match the .caf files in the iOS bundle.
 */
const SOUND_MAP_IOS: Partial<Record<PrayerSoundKey, string>> = {
  makkah_athan1: "makkah_athan1",
  medina_athan: "medina_athan",
  yasser_aldosari: "yasser_aldosari",
  athan2: "athan2",
  athan3: "athan3",
  iqama1: "iqama1",
  takbir: "takbir",
  tasbih: "tasbih",
  knock: "knock",
  beep: "beep",
};

/**
 * Get the sound URI/name for the current platform.
 *
 * - Android: Returns a resource URI like "android.resource://dev.nedaa.android/raw/makkah_athan1"
 * - iOS: Returns the sound filename without extension (e.g., "makkah_athan1")
 *
 * @param soundKey - The sound key from PrayerSoundKey
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
 * Get Android resource URI for a sound.
 */
export function getAndroidSoundUri(soundKey: PrayerSoundKey): string | undefined {
  const asset = SOUND_ASSETS[soundKey];
  if (!asset?.notificationSound) return undefined;
  // Remove extension for Android resource URI
  const soundName = asset.notificationSound.replace(/\.(mp3|wav|ogg)$/i, "");
  return `android.resource://dev.nedaa.android/raw/${soundName}`;
}

/**
 * Get iOS sound filename for AlarmKit.
 */
export function getIOSSoundName(soundKey: PrayerSoundKey): string | undefined {
  return SOUND_MAP_IOS[soundKey];
}

/**
 * Default sound key to use when none is specified.
 */
export const DEFAULT_ALARM_SOUND: PrayerSoundKey = "makkah_athan1";
