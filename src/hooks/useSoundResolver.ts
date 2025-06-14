import { Platform } from "react-native";
import { useMemo } from "react";

// Types
import type { SoundResolver } from "@/types/sound";

// Enums
import { PlatformType } from "@/enums/app";

// Constants
const IOS_EXTENSION = ".caf";
const ANDROID_EXTENSION = ".ogg";

const IOS_VALID_EXTENSIONS = [".caf", ".wav", ".aiff"];
const ANDROID_VALID_EXTENSIONS = [".ogg", ".wav", ".mp3"];

export const useSoundResolver = (): SoundResolver => {
  return useMemo(() => {
    if (Platform.OS === PlatformType.IOS) {
      return {
        getPlatformExtension: () => IOS_EXTENSION,
        getNotificationSoundName: (soundKey: string) => {
          if (soundKey === "silent") return null;
          const snakeCase = soundKey.replace(/([A-Z])/g, "_$1").toLowerCase();
          return `${snakeCase}${IOS_EXTENSION}`;
        },
        isValidSoundFile: (filename: string) =>
          IOS_VALID_EXTENSIONS.some((ext) => filename.endsWith(ext)),
      };
    } else {
      return {
        getPlatformExtension: () => ANDROID_EXTENSION,
        getNotificationSoundName: (soundKey: string) => {
          if (soundKey === "silent") return null;
          const snakeCase = soundKey.replace(/([A-Z])/g, "_$1").toLowerCase();
          return `${snakeCase}${ANDROID_EXTENSION}`;
        },
        isValidSoundFile: (filename: string) =>
          ANDROID_VALID_EXTENSIONS.some((ext) => filename.endsWith(ext)),
      };
    }
  }, []);
};

// Utility function for non-hook contexts
export const getPlatformSoundName = (soundKey: string): string | null => {
  if (soundKey === "silent") return null;

  const snakeCase = soundKey.replace(/([A-Z])/g, "_$1").toLowerCase();
  const extension = Platform.OS === PlatformType.IOS ? IOS_EXTENSION : ANDROID_EXTENSION;
  return `${snakeCase}${extension}`;
};
