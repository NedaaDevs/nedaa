import { CUSTOM_SOUND_KEY_PREFIX } from "@/types/customSound";

/**
 * Check if a sound key is a custom sound
 */
export function isCustomSoundKey(soundKey: string): boolean {
  return soundKey.startsWith(CUSTOM_SOUND_KEY_PREFIX);
}
