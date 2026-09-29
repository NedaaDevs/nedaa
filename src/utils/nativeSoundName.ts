import { SOUND_ASSETS } from "@/constants/sounds";
import type { SoundAsset } from "@/types/sound";

const BUNDLED_SOUNDS: Readonly<Record<string, SoundAsset | undefined>> = SOUND_ASSETS;

// Settings hold camelCase keys; native code plays the bundled file's base name.
// Custom sound keys have no asset and pass through unchanged.
export const getNativeSoundName = (soundKey: string): string => {
  const asset = BUNDLED_SOUNDS[soundKey];
  if (!asset?.notificationSound) return soundKey;
  return asset.notificationSound.replace(/\.[^.]+$/, "");
};
