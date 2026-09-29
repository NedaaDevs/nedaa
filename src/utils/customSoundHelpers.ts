import { CUSTOM_SOUND_KEY_PREFIX, type CustomSoundKey } from "@/types/customSound";

/**
 * Check if a sound key is a custom sound
 */
export function isCustomSoundKey(soundKey: string): soundKey is CustomSoundKey {
  return soundKey.startsWith(CUSTOM_SOUND_KEY_PREFIX);
}
