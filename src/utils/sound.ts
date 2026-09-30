// Constants
import { ALARM_SOUND_KEYS, SOUND_ASSETS, isSoundKeyValid } from "@/constants/sounds";

// Types
import type { ConfigForType, NotificationType, PrayerNotificationType } from "@/types/notification";
import type { TFunction } from "i18next";
import type { PreviewSource, SoundAsset, SoundChoice, SoundOption } from "@/types/sound";
import type { CustomSound } from "@/types/customSound";

// Stores
import { useAthkarStore } from "@/stores/athkar";

// Services

// Utils
import { isCustomSoundKey } from "@/utils/customSoundHelpers";

const BUNDLED_ASSETS: Readonly<Record<string, SoundAsset | undefined>> = SOUND_ASSETS;

/** Whether a picked sound can be stored for this alert: bundled for it, or custom. */
export const isNotificationSound = <T extends PrayerNotificationType>(
  type: T,
  value: string
): value is ConfigForType<T>["sound"] =>
  isCustomSoundKey(value) || (BUNDLED_ASSETS[value]?.availableFor.includes(type) ?? false);

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

// A preview never interrupts athkar playback.
const isAthkarAudioActive = (): boolean => {
  const athkarState = useAthkarStore.getState().playerState;
  return athkarState === "playing" || athkarState === "loading";
};

// Event emitter for state synchronization
type SoundPreviewListener = () => void;

// Singleton class to manage sound preview with enhanced type safety
// react-native-nitro-player starts a media playback service when its module initialises,
// and a background process may not start one. Previews are a foreground-only concern, so
// the player loads on demand and stays out of the notification-scheduling import graph.
// A call-time require stays lazy and, unlike import(), resolves under Jest.
const loadAudioPreview = async (): Promise<typeof import("@/services/audio/previewPlayer")> =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/services/audio/previewPlayer");

class SoundPreviewManager {
  private static instance: SoundPreviewManager;
  private isPlaying: boolean = false;
  private currentSoundId: string | null = null;
  private listeners: Set<SoundPreviewListener> = new Set();
  private watchingPlayer = false;

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
    customSounds?: import("@/types/customSound").CustomSound[]
  ): Promise<void> {
    // Check if it's a custom sound
    const isCustom = isCustomSoundKey(soundKey);

    if (isCustom) {
      const customSound = customSounds?.find((s) => s.id === soundKey);
      if (!customSound) return;
      if (!customSound.availableFor.includes(type)) return;

      await this.playSource(`${type}.${soundKey}`, customSound.contentUri);
      return;
    }

    // Handle bundled sounds
    if (!isSoundKeyValid(type, soundKey)) return;
    if (!isSoundPreviewable(type, soundKey)) return;

    const soundSource = getPreviewSource(type, soundKey);
    if (!soundSource) return;

    await this.playSource(`${type}.${soundKey}`, soundSource);
  }

  /** Plays `source` as the one preview, known to listeners as `soundId`. */
  async playSource(soundId: string, source: PreviewSource): Promise<void> {
    if (isAthkarAudioActive()) return;

    this.isPlaying = true;
    this.currentSoundId = soundId;
    this.notifyListeners();

    try {
      const player = await loadAudioPreview();
      this.watchPlayer(player);
      await player.playPreview(source);
    } catch (error) {
      console.error("[SoundPreview] Play failed:", error);
      this.forceReset();
      throw error;
    }
  }

  // A preview that plays to its end sends no stop; its finish clears it.
  private watchPlayer(player: typeof import("@/services/audio/previewPlayer")): void {
    if (this.watchingPlayer) return;
    this.watchingPlayer = true;
    player.addPreviewListener(({ didJustFinish }) => {
      if (didJustFinish && this.isPlaying) this.forceReset();
    });
  }

  async stopPreview(): Promise<void> {
    try {
      const { stopPreview } = await loadAudioPreview();
      await stopPreview();
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

/** The bundled then custom sounds a notification type can use. */
export const getSoundChoices = (
  type: NotificationType,
  customSounds: readonly CustomSound[],
  t: TFunction
): SoundChoice<string>[] => [
  ...Object.entries(BUNDLED_ASSETS).flatMap(([key, asset]) =>
    asset?.availableFor.includes(type)
      ? [{ value: key, label: t(asset.label), previewSource: asset.previewSource }]
      : []
  ),
  ...customSounds
    .filter((sound) => sound.availableFor.includes(type))
    .map((sound) => ({ value: sound.id, label: sound.name, previewSource: sound.contentUri })),
];

/** The chosen sound's name, or unset when no option offers it. */
export const chosenSoundLabel = <K extends string>(
  options: readonly SoundChoice<K>[],
  value: K,
  t: TFunction
): string =>
  options.find((option) => option.value === value)?.label ?? t("prayerDetail.soundPicker.unset");

// An alarm stores a custom sound's URI: no JS runs when it fires.
// A choice made outside the list stays listed, with nothing to preview.
export const getAlarmSoundChoices = (
  customSounds: readonly CustomSound[],
  t: TFunction,
  current: string
): SoundChoice<string>[] => {
  const bundled: SoundChoice<string>[] = ALARM_SOUND_KEYS.map((key) => ({
    value: key,
    label: t(SOUND_ASSETS[key].label),
    previewSource: SOUND_ASSETS[key].previewSource,
  }));
  const custom: SoundChoice<string>[] = customSounds.map((sound) => ({
    value: sound.contentUri,
    label: sound.name,
    previewSource: sound.contentUri,
  }));
  if (![...bundled, ...custom].some((option) => option.value === current)) {
    bundled.push({ value: current, label: t("alarm.settings.systemSound"), previewSource: null });
  }
  return [...bundled, ...custom];
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
