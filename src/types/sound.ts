// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { PRAYER_SOUNDS, IQAMA_SOUNDS, PRE_ATHAN_SOUNDS } from "@/constants/sounds";

// Types
import { NotificationType } from "@/types/notification";

export type PrayerSoundKey = keyof typeof PRAYER_SOUNDS;
export type IqamaSoundKey = keyof typeof IQAMA_SOUNDS;
export type PreAthanSoundKey = keyof typeof PRE_ATHAN_SOUNDS;

// Map notification type to its sound keys
export type NotificationSoundKey<T extends NotificationType> =
  T extends (typeof NOTIFICATION_TYPE)["PRAYER"]
    ? PrayerSoundKey
    : T extends (typeof NOTIFICATION_TYPE)["IQAMA"]
      ? IqamaSoundKey
      : T extends (typeof NOTIFICATION_TYPE)["PRE_ATHAN"]
        ? PreAthanSoundKey
        : never;

export type SoundSource = number | null;

export type SoundMapping<T extends NotificationType> = {
  [K in NotificationSoundKey<T>]: string | SoundSource;
};

// Complete sound mappings type
export type NotificationSoundMappings = {
  [T in NotificationType]: SoundMapping<T>;
};

// Sound option for UI
export type SoundOption = {
  value: string;
  label: string;
};

// Sound label mappings
export type SoundLabelMappings = {
  [T in NotificationType]: {
    [S in NotificationSoundKey<T>]: string;
  };
};
