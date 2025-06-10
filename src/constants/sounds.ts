import { NotificationSoundMappings } from "@/types/sound";

export const NOTIFICATION_SOUNDS: NotificationSoundMappings = {
  prayer: {
    makkah1: "makkahAthan1.wav",
    silent: null,
  },
  iqama: {
    silent: null,
  },
  preAthan: {
    silent: null,
  },
};

export const PRAYER_SOUNDS = {
  makkah1: "makkahAthan1",
  silent: "silent",
} as const;

export const IQAMA_SOUNDS = {
  silent: "silent",
} as const;

export const PRE_ATHAN_SOUNDS = {
  silent: "silent",
} as const;
