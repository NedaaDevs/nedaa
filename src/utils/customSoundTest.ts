/**
 * PoC Test for Custom Notification Sounds
 *
 * This file demonstrates how to use the CustomNotificationSound native module
 * to register audio files with Android's MediaStore and create notification channels
 * with custom sound URIs.
 */

import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { PlatformType } from "@/enums/app";
import { useCustomSoundsStore } from "@/stores/customSounds";

/**
 * Test function: Pick an audio file and register it as a notification sound
 */
export async function testPickAndRegisterSound() {
  if (Platform.OS !== PlatformType.ANDROID) {
    console.log("Custom notification sounds are only supported on Android");
    return;
  }

  try {
    // Step 1: Pick an audio file
    console.log("[Test] Opening file picker...");
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      console.log("[Test] File picker canceled");
      return;
    }

    const file = result.assets[0];
    console.log("[Test] File picked:", {
      name: file.name,
      uri: file.uri,
      mimeType: file.mimeType,
      size: file.size,
    });

    // Step 2: Get the local file path (DocumentPicker gives us a URI)
    let filePath = file.uri;

    // If it's a content:// URI, we need to copy it to a local file
    if (filePath.startsWith("content://")) {
      console.log("[Test] Converting content:// URI to local file...");
      const tempFilePath = `${FileSystem.cacheDirectory}temp_sound_${Date.now()}.${getExtension(file.name)}`;
      await FileSystem.copyAsync({
        from: filePath,
        to: tempFilePath,
      });
      filePath = tempFilePath;
    }

    // Remove file:// prefix if present
    filePath = filePath.replace("file://", "");

    console.log("[Test] Local file path:", filePath);

    // Step 3: Register the sound with MediaStore
    console.log("[Test] Registering sound with MediaStore...");
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    const soundTitle = `CustomSound_${Date.now()}`;
    const contentUri = await CustomNotificationSound.registerSoundFile(filePath, soundTitle);

    console.log("[Test] ✅ Sound registered successfully!");
    console.log("[Test] Content URI:", contentUri);

    // Step 4: Create a notification channel with this custom sound
    console.log("[Test] Creating notification channel with custom sound...");
    const channelId = `test_custom_sound_${Date.now()}`;
    const channelName = "Test Custom Sound";

    await CustomNotificationSound.createChannelWithCustomSound(
      channelId,
      channelName,
      contentUri,
      4, // 4 = HIGH importance
      true // vibration enabled
    );

    console.log("[Test] ✅ Notification channel created!");
    console.log("[Test] Channel ID:", channelId);

    // Step 5: Schedule a test notification to hear the custom sound
    console.log("[Test] Scheduling test notification...");
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Custom Sound Test",
        body: "This notification should play your custom sound!",
      },
      trigger: {
        seconds: 2,
        channelId: channelId,
      },
    });

    console.log("[Test] ✅ Test notification scheduled!");
    console.log("[Test] You should hear your custom sound in 2 seconds...");

    return {
      success: true,
      contentUri,
      channelId,
      soundTitle,
    };
  } catch (error) {
    console.error("[Test] ❌ Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test function: Check if a custom sound URI is still valid
 */
export async function testValidateSound(contentUri: string) {
  if (Platform.OS !== "android") {
    return false;
  }

  try {
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    const isValid = await CustomNotificationSound.isCustomSoundValid(contentUri);
    console.log("[Test] Sound URI valid:", isValid);
    return isValid;
  } catch (error) {
    console.error("[Test] Error validating sound:", error);
    return false;
  }
}

/**
 * Test function: Delete a custom sound
 */
export async function testDeleteSound(contentUri: string) {
  if (Platform.OS !== "android") {
    return false;
  }

  try {
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    const deleted = await CustomNotificationSound.deleteCustomSound(contentUri);
    console.log("[Test] Sound deleted:", deleted);
    return deleted;
  } catch (error) {
    console.error("[Test] Error deleting sound:", error);
    return false;
  }
}

// Helper function
function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "mp3";
}

/**
 * Test function: Schedule a notification with an existing custom sound in 10 seconds
 */
export async function testScheduleWithCustomSound() {
  if (Platform.OS !== PlatformType.ANDROID) {
    console.log("Custom notification sounds are only supported on Android");
    return { success: false, error: "Not on Android" };
  }

  try {
    const customSounds = useCustomSoundsStore.getState().customSounds;

    if (customSounds.length === 0) {
      console.error("[Test] No custom sounds available. Please add a custom sound first.");
      return { success: false, error: "No custom sounds available" };
    }

    // Use the first custom sound
    const customSound = customSounds[0];
    console.log("[Test] Using custom sound:", customSound.name);

    // Create a test notification channel with the custom sound
    const { default: CustomNotificationSound } = await import("expo-custom-notification-sound");
    const channelId = `test_channel_${Date.now()}`;
    const channelName = `Test: ${customSound.name}`;

    console.log("[Test] Creating notification channel...");
    await CustomNotificationSound.createChannelWithCustomSound(
      channelId,
      channelName,
      customSound.contentUri,
      4, // HIGH importance
      true // vibration enabled
    );

    // Schedule the notification in 10 seconds
    console.log("[Test] Scheduling notification in 10 seconds...");
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Custom Sound Test",
        body: `Testing: ${customSound.name}`,
      },
      trigger: {
        seconds: 10,
        channelId: channelId,
      },
    });

    console.log("[Test] ✅ Notification scheduled successfully!");
    console.log("[Test] You should hear the custom sound in 10 seconds...");

    return {
      success: true,
      soundName: customSound.name,
      channelId,
    };
  } catch (error) {
    console.error("[Test] ❌ Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Usage example:
 *
 * import { testPickAndRegisterSound, testScheduleWithCustomSound } from '@/utils/customSoundTest';
 *
 * // In a component:
 * const handleTest = async () => {
 *   const result = await testPickAndRegisterSound();
 *   console.log('Test result:', result);
 * };
 *
 * // To test an existing custom sound:
 * const handleQuickTest = async () => {
 *   const result = await testScheduleWithCustomSound();
 *   console.log('Test result:', result);
 * };
 */
