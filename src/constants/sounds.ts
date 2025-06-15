// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

// Types
import type { NotificationType } from "@/types/notification";
import type { SoundAssetsConfig, ExtractSoundKeys } from "@/types/sound";

// Hooks
import { getPlatformSoundName } from "@/hooks/useSoundResolver";

// Define all sound assets with proper typing
export const SOUND_ASSETS = {
  makkahAthan1: {
    get notificationSound() {
      return getPlatformSoundName("makkah_athan1");
    },
    previewSource: require("@/assets/sounds/makkah_athan1.mp3"),
    label: "notification.sound.makkahAthan1",
    availableFor: [NOTIFICATION_TYPE.PRAYER] as const,
  },
  yasserAldosari: {
    get notificationSound() {
      return getPlatformSoundName("yasser_aldosari");
    },
    previewSource: require("@/assets/sounds/yasser_aldosari.mp3"),
    label: "notification.sound.yasserAldosari",
    availableFor: [NOTIFICATION_TYPE.PRAYER] as const,
  },
  tasbih: {
    get notificationSound() {
      return getPlatformSoundName("tasbih");
    },
    previewSource: require("@/assets/sounds/tasbih.mp3"),
    label: "notification.sound.tasbih",
    availableFor: Object.values(NOTIFICATION_TYPE) as NotificationType[],
  },
  silent: {
    notificationSound: null,
    previewSource: null,
    label: "notification.sound.silent",
    availableFor: Object.values(NOTIFICATION_TYPE) as NotificationType[],
  },
} as const satisfies SoundAssetsConfig;

// Helper function to create sound mappings with proper typing
const createSoundMapping = <T extends NotificationType>(type: T): Record<string, string> => {
  const mapping: Record<string, string> = {};

  Object.entries(SOUND_ASSETS).forEach(([key, asset]) => {
    if ((asset.availableFor as readonly NotificationType[]).includes(type)) {
      mapping[key] = key;
    }
  });

  return mapping;
};

export const PRAYER_SOUNDS = createSoundMapping(NOTIFICATION_TYPE.PRAYER);
export const IQAMA_SOUNDS = createSoundMapping(NOTIFICATION_TYPE.IQAMA);
export const PRE_ATHAN_SOUNDS = createSoundMapping(NOTIFICATION_TYPE.PRE_ATHAN);

// Export properly typed sound keys
export type PrayerSoundKey = ExtractSoundKeys<typeof SOUND_ASSETS, typeof NOTIFICATION_TYPE.PRAYER>;
export type IqamaSoundKey = ExtractSoundKeys<typeof SOUND_ASSETS, typeof NOTIFICATION_TYPE.IQAMA>;
export type PreAthanSoundKey = ExtractSoundKeys<
  typeof SOUND_ASSETS,
  typeof NOTIFICATION_TYPE.PRE_ATHAN
>;

// Type guard to check if a key is valid for a notification type
export function isSoundKeyValid<T extends NotificationType>(
  type: T,
  key: string
): key is ExtractSoundKeys<typeof SOUND_ASSETS, T> {
  const asset = SOUND_ASSETS[key as keyof typeof SOUND_ASSETS];
  return asset && (asset.availableFor as readonly NotificationType[]).includes(type);
}
