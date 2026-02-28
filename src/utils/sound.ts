import TrackPlayer from "react-native-track-player";

// Constants
import { SOUND_ASSETS, isSoundKeyValid } from "@/constants/sounds";

// Types
import type { NotificationType } from "@/types/notification";
import type { SoundOption, SoundAsset } from "@/types/sound";
import type { CustomSound } from "@/types/customSound";

// Stores
import { useAthkarStore } from "@/stores/athkar";

// Utils
import { isCustomSoundKey } from "@/utils/customSoundHelpers";

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
): string | number | null => {
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
  private playerReady: boolean = false;
  private setupPromise: Promise<void> | null = null;

  private constructor() {}

  private async ensurePlayerReady(): Promise<void> {
    if (this.playerReady) return;
    if (this.setupPromise) return this.setupPromise;

    this.setupPromise = (async () => {
      try {
        await TrackPlayer.setupPlayer({
          autoHandleInterruptions: true,
        });
        this.playerReady = true;
      } catch (error) {
        if ((error as Error)?.message?.includes("already been initialized")) {
          this.playerReady = true;
        } else {
          console.error("[SoundPreview] Setup failed:", error);
          this.setupPromise = null;
          throw error;
        }
      }
    })();

    return this.setupPromise;
  }

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
    customSounds?: import("@/types/customSound").CustomSound[]
  ): Promise<void> {
    await this.ensurePlayerReady();

    // Guard: don't interrupt active athkar playback
    const athkarState = useAthkarStore.getState().playerState;
    if (athkarState === "playing" || athkarState === "loading") {
      return;
    }

    // Check if it's a custom sound
    const isCustom = isCustomSoundKey(soundKey);

    if (isCustom) {
      const customSound = customSounds?.find((s) => s.id === soundKey);
      if (!customSound) return;
      if (!customSound.availableFor.includes(type)) return;

      const soundId = `${type}.${soundKey}`;

      try {
        if (this.isPlaying) {
          this.isPlaying = false;
          this.currentSoundId = null;
          this.notifyListeners();
        }

        this.isPlaying = true;
        this.currentSoundId = soundId;
        this.notifyListeners();

        await TrackPlayer.reset();
        await TrackPlayer.add({ url: customSound.contentUri, title: soundKey });
        await TrackPlayer.play();
      } catch (error) {
        console.error("[SoundPreview] Custom play failed:", error);
        this.isPlaying = false;
        this.currentSoundId = null;
        this.notifyListeners();
        throw error;
      }
      return;
    }

    // Handle bundled sounds
    if (!isSoundKeyValid(type, soundKey)) return;
    if (!isSoundPreviewable(type, soundKey)) return;

    const soundSource = getPreviewSource(type, soundKey);
    if (!soundSource) return;

    const soundId = `${type}.${soundKey}`;

    try {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.currentSoundId = null;
        this.notifyListeners();
      }

      this.isPlaying = true;
      this.currentSoundId = soundId;
      this.notifyListeners();

      await TrackPlayer.reset();
      // TrackPlayer.add() accepts url: string | ResourceObject (number from require())
      // This lets RNTP natively resolve bundled assets on both emulator and physical devices
      await TrackPlayer.add({ url: soundSource as string, title: soundKey });
      await TrackPlayer.play();
    } catch (error) {
      console.error("[SoundPreview] Play failed:", error);
      this.isPlaying = false;
      this.currentSoundId = null;
      this.notifyListeners();
      throw error;
    }
  }

  async stopPreview(): Promise<void> {
    try {
      if (!this.playerReady) return;
      await TrackPlayer.reset();
      this.isPlaying = false;
      this.currentSoundId = null;
      this.notifyListeners();
    } catch (error) {
      console.error("Error stopping sound preview:", error);
      this.isPlaying = false;
      this.currentSoundId = null;
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

  // Force reset state (useful for cleanup)
  forceReset(): void {
    this.isPlaying = false;
    this.currentSoundId = null;
    this.notifyListeners();
  }
}

export const soundPreviewManager = SoundPreviewManager.getInstance();

// ============================================================================
// Custom Sounds Integration
// ============================================================================

/**
 * Get available sounds including custom sounds for a notification type
 */
export const getAvailableSoundsWithCustom = <T extends NotificationType>(
  type: T,
  customSounds: CustomSound[]
): SoundOption[] => {
  // Get bundled sounds
  const bundledSounds = getAvailableSounds(type);

  // Get custom sounds for this type
  const customSoundOptions: SoundOption[] = customSounds
    .filter((sound) => sound.availableFor.includes(type))
    .map((sound) => ({
      value: sound.id,
      label: sound.name,
      isPreviewable: true, // Custom sounds are always previewable
      isCustom: true,
    }));

  return [...bundledSounds, ...customSoundOptions];
};

/**
 * Get notification sound including custom sounds
 * Returns the sound identifier for notification channels
 */
export const getNotificationSoundWithCustom = <T extends NotificationType>(
  type: T,
  soundKey: string,
  customSounds: CustomSound[]
): string | null => {
  // Check if it's a custom sound
  if (isCustomSoundKey(soundKey)) {
    const customSound = customSounds.find((s) => s.id === soundKey);
    return customSound?.contentUri ?? null;
  }

  // Otherwise, get bundled sound
  return getNotificationSound(type, soundKey);
};

/**
 * Get custom sound by key
 */
export const getCustomSound = (
  soundKey: string,
  customSounds: CustomSound[]
): CustomSound | null => {
  if (!isCustomSoundKey(soundKey)) {
    return null;
  }
  return customSounds.find((s) => s.id === soundKey) ?? null;
};

/**
 * Check if a sound key is valid (bundled or custom)
 */
export const isSoundKeyValidWithCustom = <T extends NotificationType>(
  type: T,
  soundKey: string,
  customSounds: CustomSound[]
): boolean => {
  // Check bundled sounds
  if (isSoundKeyValid(type, soundKey)) {
    return true;
  }

  // Check custom sounds
  if (isCustomSoundKey(soundKey)) {
    const customSound = customSounds.find((s) => s.id === soundKey);
    return customSound ? customSound.availableFor.includes(type) : false;
  }

  return false;
};
