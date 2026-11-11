import { SYSTEM_SOUND } from "@/constants/Notification";

// A channel with no sound key plays the device sound; "default" reads as a
// missing sound file to expo-notifications.
export const channelSoundOption = (sound: string | null | undefined) =>
  sound === SYSTEM_SOUND ? {} : { sound };
