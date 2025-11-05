import { NotificationType } from "@/types/notification";

/**
 * Custom notification sound registered by the user
 */
export type CustomSound = {
  /** Unique identifier */
  id: string;

  /** User-defined name for the sound */
  name: string;

  /** Android MediaStore content:// URI */
  contentUri: string;

  /** Original filename */
  fileName: string;

  /** File size in bytes */
  fileSize: number;

  /** Which notification types this sound is available for */
  availableFor: NotificationType[];

  /** When this sound was added */
  dateAdded: string;
};

/**
 * Result from picking and adding a custom sound
 */
export type AddCustomSoundResult =
  | {
      success: true;
      sound: CustomSound;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Storage key for custom sounds in AsyncStorage/SQLite
 */
export const CUSTOM_SOUNDS_STORAGE_KEY = "custom_sounds";

/**
 * Maximum file size for custom sounds (5MB)
 */
export const MAX_CUSTOM_SOUND_SIZE = 5 * 1024 * 1024;

/**
 * Supported audio file extensions
 */
export const SUPPORTED_AUDIO_EXTENSIONS = [".mp3", ".ogg", ".wav", ".m4a", ".aac"] as const;

/**
 * Custom sound key prefix to distinguish from bundled sounds
 */
export const CUSTOM_SOUND_KEY_PREFIX = "custom_";
