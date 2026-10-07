/** Largest custom sound file accepted, in megabytes; the add-sound copy states it. */
export const CUSTOM_SOUND_MAX_MB = 5;
export const CUSTOM_SOUND_MAX_BYTES = CUSTOM_SOUND_MAX_MB * 1024 * 1024;

/** Failure codes an add returns; the modal maps them to copy. */
export const CUSTOM_SOUND_ERROR = {
  DUPLICATE: "duplicate",
  TOO_LARGE: "tooLarge",
} as const;

export type CustomSoundError = (typeof CUSTOM_SOUND_ERROR)[keyof typeof CUSTOM_SOUND_ERROR];
