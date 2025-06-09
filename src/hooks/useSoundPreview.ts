import { useState, useEffect, useCallback } from "react";
import { useAudioPlayer } from "expo-audio";

// Utils
import { soundPreviewManager } from "@/utils/sound";

// Types
import type { NotificationType } from "@/types/notification";
import type { NotificationSoundKey } from "@/types/sound";

type UseSoundPreviewReturn = {
  playPreview: <T extends NotificationType>(
    type: T,
    soundKey: NotificationSoundKey<T>
  ) => Promise<void>;
  stopPreview: () => Promise<void>;
  isPlaying: boolean;
  currentSound: string | null;
  isPlayingSound: <T extends NotificationType>(
    type: T,
    soundKey: NotificationSoundKey<T>
  ) => boolean;
};

export const useSoundPreview = (): UseSoundPreviewReturn => {
  const player = useAudioPlayer();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSound, setCurrentSound] = useState<string | null>(null);

  useEffect(() => {
    // Initialize the sound manager with the player
    soundPreviewManager.setPlayer(player);

    // Setup interval to sync state with manager
    const interval = setInterval(() => {
      setIsPlaying(soundPreviewManager.isCurrentlyPlaying());
      setCurrentSound(soundPreviewManager.getCurrentSound());
    }, 100);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      soundPreviewManager.stopPreview();
    };
  }, [player]);

  const playPreview = useCallback(
    async <T extends NotificationType>(type: T, soundKey: NotificationSoundKey<T>) => {
      setIsPlaying(true);
      setCurrentSound(`${type}.${soundKey}`);

      try {
        await soundPreviewManager.playPreview(type, soundKey);
      } catch (error) {
        console.error("Error in playPreview:", error);
        setIsPlaying(false);
        setCurrentSound(null);
      }
    },
    []
  );

  const stopPreview = useCallback(async () => {
    await soundPreviewManager.stopPreview();
    setIsPlaying(false);
    setCurrentSound(null);
  }, []);

  const isPlayingSound = useCallback(
    <T extends NotificationType>(type: T, soundKey: NotificationSoundKey<T>): boolean => {
      return isPlaying && currentSound === `${type}.${soundKey}`;
    },
    [isPlaying, currentSound]
  );

  return {
    playPreview,
    stopPreview,
    isPlaying,
    currentSound,
    isPlayingSound,
  };
};
