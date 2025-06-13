import { useAudioPlayer, AudioSource } from "expo-audio";

// Constants
import { SOUND_ASSETS, isSoundKeyValid } from "@/constants/sounds";

// Types
import type { NotificationType } from "@/types/notification";
import type { SoundOption, SoundAsset } from "@/types/sound";

// Type-safe helper to get available sounds
export const getAvailableSounds = <T extends NotificationType>(type: T): SoundOption[] => {
  return Object.entries(SOUND_ASSETS)
    .filter(([_, asset]) => (asset.availableFor as readonly NotificationType[]).includes(type))
    .map(([key, asset]) => ({
      value: key,
      label: asset.label,
      isPreviewable: asset.previewSource !== null,
    }));
};

export const getSoundAsset = <T extends NotificationType>(
  type: T,
  soundKey: string
): SoundAsset | null => {
  if (!isSoundKeyValid(type, soundKey)) {
    return null;
  }
  const asset = SOUND_ASSETS[soundKey as keyof typeof SOUND_ASSETS];
  return asset || null;
};

export const getNotificationSound = <T extends NotificationType>(
  type: T,
  soundKey: string
): string | null => {
  const asset = getSoundAsset(type, soundKey);
  return asset?.notificationSound ?? null;
};

export const getPreviewSource = <T extends NotificationType>(
  type: T,
  soundKey: string
): AudioSource | null => {
  const asset = getSoundAsset(type, soundKey);
  return asset?.previewSource ?? null;
};

// Type-safe previewability check
export const isSoundPreviewable = <T extends NotificationType>(
  type: T,
  soundKey: string
): boolean => {
  const asset = getSoundAsset(type, soundKey);
  return asset?.previewSource !== null;
};

// Event emitter for state synchronization
type SoundPreviewListener = () => void;

// Singleton class to manage sound preview with enhanced type safety
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
    soundKey: string,
    player: ReturnType<typeof useAudioPlayer>,
    playerId: string
  ): Promise<void> {
    // Type-safe validation
    if (!isSoundKeyValid(type, soundKey)) {
      console.error(`Invalid sound key: ${soundKey} for type: ${type}`);
      return;
    }

    // Don't play if not previewable(silent)
    if (!isSoundPreviewable(type, soundKey)) {
      return;
    }

    const soundSource = getPreviewSource(type, soundKey);

    if (!soundSource) {
      console.error(`Sound preview source not found: ${type}.${soundKey}`);
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
      this.currentSoundSource = soundSource;
      this.currentPlayerId = playerId;
      this.notifyListeners();

      await player.replace(soundSource);
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
