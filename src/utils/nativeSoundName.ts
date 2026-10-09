import { SOUND_ASSETS } from "@/constants/sounds";

// Settings hold camelCase keys; native code plays the bundled file's base name.
// Custom sound keys have no asset and pass through unchanged.
export const getNativeSoundName = (soundKey: string): string => {
  const asset = SOUND_ASSETS[soundKey as keyof typeof SOUND_ASSETS];
  if (!asset?.notificationSound) return soundKey;
  return asset.notificationSound.replace(/\.[^.]+$/, "");
};
