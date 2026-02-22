import { useState, useEffect, useCallback, useRef } from "react";

// Utils
import { soundPreviewManager } from "@/utils/sound";

// Types
import type { NotificationType } from "@/types/notification";
import type { NotificationSoundKey } from "@/types/sound";

// Stores
import { useCustomSoundsStore } from "@/stores/customSounds";

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
  const { customSounds } = useCustomSoundsStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSound, setCurrentSound] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Sync initial state
    const syncState = () => {
      if (isMountedRef.current) {
        setIsPlaying(soundPreviewManager.isCurrentlyPlaying());
        setCurrentSound(soundPreviewManager.getCurrentSound());
      }
    };

    // Initial sync
    syncState();

    // Subscribe to state changes
    const unsubscribe = soundPreviewManager.addListener(syncState);

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, []);

  const playPreview = useCallback(
    async <T extends NotificationType>(type: T, soundKey: NotificationSoundKey<T>) => {
      try {
        await soundPreviewManager.playPreview(type, soundKey, customSounds);
      } catch (error) {
        console.error("Error in playPreview:", error);
      }
    },
    [customSounds]
  );

  const stopPreview = useCallback(async () => {
    try {
      await soundPreviewManager.stopPreview();
    } catch (error) {
      console.error("Error in stopPreview:", error);
      // If we can't stop it properly, at least reset the state
      soundPreviewManager.forceReset();
    }
  }, []);

  const isPlayingSound = useCallback(
    <T extends NotificationType>(type: T, soundKey: NotificationSoundKey<T>): boolean => {
      return soundPreviewManager.isCurrentlyPlaying(`${type}.${soundKey}`);
    },
    []
  );

  return {
    playPreview,
    stopPreview,
    isPlaying,
    currentSound,
    isPlayingSound,
  };
};
