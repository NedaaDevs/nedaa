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
  isCustom?: boolean;
};

/** What the preview player accepts: a bundled asset module or a file URI. */
export type PreviewSource = string | number;

/** One sound a picker offers, stored as `value` and played from `previewSource`. */
export type SoundChoice<K extends string> = {
  value: K;
  /** Display text, already translated. */
  label: string;
  /** Null when the sound has nothing to play, such as silent. */
  previewSource: PreviewSource | null;
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
