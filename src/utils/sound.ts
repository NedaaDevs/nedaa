import { useAudioPlayer, AudioSource } from "expo-audio";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

// Types
import type { NotificationSoundKey, SoundLabelMappings, SoundOption } from "@/types/sound";
import { NotificationType } from "@/types/notification";
import { NOTIFICATION_SOUNDS } from "@/constants/sounds";

// Sound labels for UI
export const SOUND_LABELS: SoundLabelMappings = {
  prayer: {
    makkah1: "notification.sound.makkahAthan1",
    silent: "notification.sound.silent",
  },
  iqama: {
    silent: "notification.sound.silent",
  },
  preAthan: {
    silent: "notification.sound.silent",
  },
};

// Type-safe function to get available sounds
export const getAvailableSounds = <T extends keyof typeof NOTIFICATION_TYPE>(
  type: (typeof NOTIFICATION_TYPE)[T]
): SoundOption[] => {
  const labels = SOUND_LABELS[type];
  return Object.entries(labels).map(([value, label]) => ({
    value,
    label: label as string,
  }));
};

export const getSoundSource = <T extends NotificationType>(
  type: T,
  soundKey: NotificationSoundKey<T>
): string | AudioSource | null => {
  return NOTIFICATION_SOUNDS[type][soundKey];
};

// Type-safe function to check if sound is previewable
export const isSoundPreviewable = <T extends NotificationType>(
  soundKey: NotificationSoundKey<T>
): boolean => {
  return soundKey !== "silent";
};

// Event emitter for state synchronization
type SoundPreviewListener = () => void;

// Singleton class to manage sound preview
class SoundPreviewManager {
  private static instance: SoundPreviewManager;
  private isPlaying: boolean = false;
  private currentSoundId: string | null = null;
  private listeners: Set<SoundPreviewListener> = new Set();
  private currentSoundSource: AudioSource | null = null;
  private currentPlayerId: string | null = null;

  private constructor() {}

  static getInstance(): SoundPreviewManager {
    if (!SoundPreviewManager.instance) {
      SoundPreviewManager.instance = new SoundPreviewManager();
    }
    return SoundPreviewManager.instance;
  }

  // Add listener for state changes
  addListener(listener: SoundPreviewListener): () => void {
    this.listeners.add(listener);
    // Return cleanup function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Notify all listeners of state change
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  async playPreview<T extends NotificationType>(
    type: T,
    soundKey: NotificationSoundKey<T>,
    player: ReturnType<typeof useAudioPlayer>,
    playerId: string
  ): Promise<void> {
    // Don't play if not previewable
    if (!isSoundPreviewable(soundKey)) {
      return;
    }

    const soundSource = getSoundSource(type, soundKey);

    if (!soundSource) {
      console.error(`Sound not found: ${type}.${soundKey}`);
      return;
    }

    const soundId = `${type}.${soundKey}`;

    try {
      // Stop any currently playing sound first
      if (this.isPlaying) {
        // Just update state, don't try to stop old player
        this.isPlaying = false;
        this.currentSoundId = null;
        this.currentPlayerId = null;
        this.notifyListeners();
      }

      this.isPlaying = true;
      this.currentSoundId = soundId;
      this.currentSoundSource = soundSource as AudioSource;
      this.currentPlayerId = playerId;
      this.notifyListeners();

      await player.replace(soundSource as AudioSource);
      await player.play();
    } catch (error) {
      console.error("Error playing sound preview:", error);
      this.isPlaying = false;
      this.currentSoundId = null;
      this.currentSoundSource = null;
      this.currentPlayerId = null;
      this.notifyListeners();
      throw error;
    }
  }

  async stopPreview(player: ReturnType<typeof useAudioPlayer>): Promise<void> {
    try {
      await player.pause();
      await player.seekTo(0);
      this.isPlaying = false;
      this.currentSoundId = null;
      this.currentSoundSource = null;
      this.currentPlayerId = null;
      this.notifyListeners();
    } catch (error) {
      console.error("Error stopping sound preview:", error);
      // Force reset state even if error occurs
      this.isPlaying = false;
      this.currentSoundId = null;
      this.currentSoundSource = null;
      this.currentPlayerId = null;
      this.notifyListeners();
    }
  }

  isCurrentlyPlaying(soundId?: string): boolean {
    if (soundId) {
      return this.isPlaying && this.currentSoundId === soundId;
    }
    return this.isPlaying;
  }

  getCurrentSound(): string | null {
    return this.currentSoundId;
  }

  getCurrentSoundSource(): AudioSource | null {
    return this.currentSoundSource;
  }

  // Notify when a player is unmounting
  notifyPlayerUnmount(playerId: string): void {
    if (this.currentPlayerId === playerId) {
      // The player that was playing is unmounting, so reset state
      this.isPlaying = false;
      this.currentSoundId = null;
      this.currentSoundSource = null;
      this.currentPlayerId = null;
      this.notifyListeners();
    }
  }

  // Force reset state (useful for cleanup)
  forceReset(): void {
    this.isPlaying = false;
    this.currentSoundId = null;
    this.currentSoundSource = null;
    this.currentPlayerId = null;
    this.notifyListeners();
  }
}

export const soundPreviewManager = SoundPreviewManager.getInstance();
