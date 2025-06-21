import { useState, useEffect, useCallback, useRef } from "react";
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
  const isMountedRef = useRef(true);
  const playerIdRef = useRef(`player-${Date.now()}-${Math.random()}`);

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
      // Notify the manager that this player is unmounting
      // eslint-disable-next-line react-hooks/exhaustive-deps
      soundPreviewManager.notifyPlayerUnmount(playerIdRef.current);
    };
  }, [player]);

  const playPreview = useCallback(
    async <T extends NotificationType>(type: T, soundKey: NotificationSoundKey<T>) => {
      try {
        await soundPreviewManager.playPreview(type, soundKey, player, playerIdRef.current);
      } catch (error) {
        console.error("Error in playPreview:", error);
      }
    },
    [player]
  );

  const stopPreview = useCallback(async () => {
    try {
      await soundPreviewManager.stopPreview(player);
    } catch (error) {
      console.error("Error in stopPreview:", error);
      // If we can't stop it properly, at least reset the state
      soundPreviewManager.forceReset();
    }
  }, [player]);

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
