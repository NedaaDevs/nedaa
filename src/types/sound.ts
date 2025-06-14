// Types
import { NotificationType } from "@/types/notification";

// Base sound asset type
export type SoundAsset = {
  notificationSound: string | null;
  previewSource: any | null;
  label: string;
  availableFor: readonly NotificationType[];
};

// Sound option type for UI
export type SoundOption = {
  value: string;
  label: string;
  isPreviewable: boolean;
};

// Type-safe sound assets configuration
export type SoundAssetsConfig = {
  readonly [K: string]: SoundAsset;
};

// Extract sound keys available for a specific notification type
export type ExtractSoundKeys<
  TAssets extends SoundAssetsConfig,
  TNotificationType extends NotificationType,
> = {
  [K in keyof TAssets]: TNotificationType extends TAssets[K]["availableFor"][number] ? K : never;
}[keyof TAssets];

export type NotificationSoundKey<T extends NotificationType> = string;

export type SoundMapping = Record<string, string>;

export type NotificationSoundMappings = {
  [K in NotificationType]: SoundMapping;
};

export type SoundResolver = {
  getNotificationSoundName(soundKey: string): string | null;
  getPlatformExtension(): string;
  isValidSoundFile(filename: string): boolean;
};
