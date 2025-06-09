import { useAudioPlayer, AudioSource } from "expo-audio";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

// Types
import type {
  NotificationSoundKey,
  NotificationSoundMappings,
  SoundLabelMappings,
  SoundOption,
} from "@/types/sound";
import { NotificationType } from "@/types/notification";

export const NOTIFICATION_SOUNDS: NotificationSoundMappings = {
  prayer: {
    makkah1: require("@/assets/sounds/makkahAthan1.mp3"),
    silent: null,
  },
  iqama: {
    silent: null,
  },
  preAthan: {
    silent: null,
  },
};

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
): number | null => {
  return NOTIFICATION_SOUNDS[type][soundKey];
};

// Type-safe function to check if sound is previewable
export const isSoundPreviewable = <T extends NotificationType>(
  soundKey: NotificationSoundKey<T>
): boolean => {
  return soundKey !== "silent";
};

// Singleton class to manage sound preview
class SoundPreviewManager {
  private static instance: SoundPreviewManager;
  private currentPlayer: ReturnType<typeof useAudioPlayer> | null = null;
  private isPlaying: boolean = false;
  private currentSoundId: string | null = null;

  private constructor() {}

  static getInstance(): SoundPreviewManager {
    if (!SoundPreviewManager.instance) {
      SoundPreviewManager.instance = new SoundPreviewManager();
    }
    return SoundPreviewManager.instance;
  }

  setPlayer(player: ReturnType<typeof useAudioPlayer>) {
    this.currentPlayer = player;
  }

  async playPreview<T extends NotificationType>(
    type: T,
    soundKey: NotificationSoundKey<T>
  ): Promise<void> {
    if (!this.currentPlayer) {
      console.error("Audio player not initialized");
      return;
    }

    // Stop any currently playing sound
    await this.stopPreview();

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
      this.isPlaying = true;
      this.currentSoundId = soundId;
      await this.currentPlayer.replace(soundSource as AudioSource);
      await this.currentPlayer.play();
    } catch (error) {
      console.error("Error playing sound preview:", error);
      this.isPlaying = false;
      this.currentSoundId = null;
    }
  }

  async stopPreview(): Promise<void> {
    if (!this.currentPlayer || !this.isPlaying) return;

    try {
      await this.currentPlayer.pause();
      await this.currentPlayer.seekTo(0);
      this.isPlaying = false;
      this.currentSoundId = null;
    } catch (error) {
      console.error("Error stopping sound preview:", error);
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
}

export const soundPreviewManager = SoundPreviewManager.getInstance();
