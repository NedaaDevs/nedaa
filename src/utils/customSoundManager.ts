import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

// Enums
import { PlatformType } from "@/enums/app";

// Types
import type { CustomSound, AddCustomSoundResult } from "@/types/customSound";
import type { NotificationType } from "@/types/notification";
import { SUPPORTED_AUDIO_EXTENSIONS, CUSTOM_SOUND_KEY_PREFIX } from "@/types/customSound";

/**
 * Pick an audio file from the device
 */
export async function pickAudioFile(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  if (Platform.OS !== PlatformType.ANDROID) {
    throw new Error("Custom sounds are only supported on Android");
  }

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0];
  } catch (error) {
    console.error("[CustomSoundManager] Error picking file:", error);
    throw error;
  }
}

/**
 * Validate an audio file
 */
export function validateAudioFile(file: DocumentPicker.DocumentPickerAsset): {
  valid: boolean;
  error?: string;
} {
  // Check file extension
  const extension = getFileExtension(file.name);
  if (!SUPPORTED_AUDIO_EXTENSIONS.includes(extension as any)) {
    return {
      valid: false,
      error: `Unsupported file format. Supported formats: ${SUPPORTED_AUDIO_EXTENSIONS.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Add a custom notification sound
 */
export async function addCustomSound(
  file: DocumentPicker.DocumentPickerAsset,
  name: string,
  availableFor: NotificationType[]
): Promise<AddCustomSoundResult> {
  if (Platform.OS !== PlatformType.ANDROID) {
    return {
      success: false,
      error: "Custom sounds are only supported on Android",
    };
  }

  try {
    // Validate file
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error!,
      };
    }

    // Get local file path
    let filePath = file.uri;

    // If it's a content:// URI, copy to local file
    if (filePath.startsWith("content://")) {
      const tempFilePath = `${FileSystem.cacheDirectory}temp_sound_${Date.now()}${getFileExtension(file.name)}`;
      await FileSystem.copyAsync({
        from: filePath,
        to: tempFilePath,
      });
      filePath = tempFilePath;
    }

    // Remove file:// prefix if present
    filePath = filePath.replace("file://", "");

    // Register with MediaStore (conditionally import on Android only)
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    const soundTitle = `Nedaa_${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const contentUri = await CustomNotificationSound.registerSoundFile(filePath, soundTitle);

    // Create custom sound object
    const customSound: CustomSound = {
      id: generateCustomSoundId(),
      name,
      contentUri,
      fileName: file.name,
      fileSize: file.size || 0,
      availableFor,
      dateAdded: new Date().toISOString(),
    };

    // Clean up temp file if we created one
    if (filePath.includes("temp_sound_")) {
      try {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      } catch (error) {
        console.warn("[CustomSoundManager] Failed to delete temp file:", error);
      }
    }

    return {
      success: true,
      sound: customSound,
    };
  } catch (error) {
    console.error("[CustomSoundManager] Error adding custom sound:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add custom sound",
    };
  }
}

/**
 * Delete a custom sound from MediaStore
 */
export async function deleteCustomSoundFromMediaStore(contentUri: string): Promise<boolean> {
  if (Platform.OS !== PlatformType.ANDROID) {
    return false;
  }

  try {
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    const deleted = await CustomNotificationSound.deleteCustomSound(contentUri);
    console.log("[CustomSoundManager] Deleted from MediaStore:", deleted);
    return deleted;
  } catch (error) {
    console.error("[CustomSoundManager] Error deleting from MediaStore:", error);
    return false;
  }
}

/**
 * Validate if a custom sound URI is still valid
 */
export async function validateCustomSoundUri(contentUri: string): Promise<boolean> {
  if (Platform.OS !== PlatformType.ANDROID) {
    return false;
  }

  try {
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    return await CustomNotificationSound.isCustomSoundValid(contentUri);
  } catch (error) {
    console.error("[CustomSoundManager] Error validating URI:", error);
    return false;
  }
}

/**
 * Get the file extension from a filename
 */
function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
}

/**
 * Generate a unique ID for a custom sound
 */
function generateCustomSoundId(): string {
  return `${CUSTOM_SOUND_KEY_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get custom sound key for use in sound selectors
 * This makes custom sounds compatible with the existing sound system
 */
export function getCustomSoundKey(customSound: CustomSound): string {
  return customSound.id;
}

/**
 * Check if a sound key is a custom sound
 */
export function isCustomSoundKey(soundKey: string): boolean {
  return soundKey.startsWith(CUSTOM_SOUND_KEY_PREFIX);
}

/**
 * Calculate total storage used by custom sounds
 */
export function calculateTotalStorage(customSounds: CustomSound[]): number {
  return customSounds.reduce((total, sound) => total + sound.fileSize, 0);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
