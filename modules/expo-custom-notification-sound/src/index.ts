import { requireNativeModule } from "expo-modules-core";

// Define the native module interface
export interface CustomNotificationSoundModule {
  /**
   * Register a sound file with MediaStore and return its content:// URI
   * @param filePath - Path to the audio file
   * @param title - Display name for the sound
   * @returns Promise with the content:// URI
   */
  registerSoundFile(filePath: string, title: string): Promise<string>;

  /**
   * Create a notification channel with custom sound URI
   * @param channelId - Unique channel ID
   * @param channelName - Display name for the channel
   * @param soundUri - content:// URI of the registered sound
   * @param importance - Android notification importance level (1-5)
   * @param vibration - Whether to enable vibration
   */
  createChannelWithCustomSound(
    channelId: string,
    channelName: string,
    soundUri: string,
    importance: number,
    vibration: boolean
  ): Promise<void>;

  /**
   * Delete a custom sound from MediaStore
   * @param contentUri - The content:// URI to delete
   */
  deleteCustomSound(contentUri: string): Promise<boolean>;

  /**
   * Check if a custom sound URI is still valid
   * @param contentUri - The content:// URI to check
   */
  isCustomSoundValid(contentUri: string): Promise<boolean>;
}

// Load the native module
const CustomNotificationSound =
  requireNativeModule<CustomNotificationSoundModule>("CustomNotificationSound");

export default CustomNotificationSound;
