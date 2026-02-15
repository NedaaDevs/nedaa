export const PLAYBACK_MODE = {
  AUTOPILOT: "autopilot",
  MANUAL: "manual",
  OFF: "off",
} as const;

export const REPEAT_LIMIT_OPTIONS = [
  {
    value: "all",
    labelKey: "settings.athkarAudio.repeat.all",
    descKey: "settings.athkarAudio.repeat.allDesc",
  },
  {
    value: 1,
    labelKey: "settings.athkarAudio.repeat.once",
    descKey: "settings.athkarAudio.repeat.onceDesc",
  },
  {
    value: 3,
    labelKey: "settings.athkarAudio.repeat.first3",
    descKey: "settings.athkarAudio.repeat.first3Desc",
  },
  {
    value: 5,
    labelKey: "settings.athkarAudio.repeat.first5",
    descKey: "settings.athkarAudio.repeat.first5Desc",
  },
  {
    value: 10,
    labelKey: "settings.athkarAudio.repeat.first10",
    descKey: "settings.athkarAudio.repeat.first10Desc",
  },
] as const;

// Smart pause durations (ms) based on audio length
export const SMART_PAUSE = {
  SHORT_THRESHOLD: 5, // seconds
  LONG_THRESHOLD: 30, // seconds
  SHORT_PAUSE: 1500, // ms - for audio < 5s
  MEDIUM_PAUSE: 500, // ms - for audio 5-30s
  LONG_PAUSE: 0, // ms - for audio > 30s
} as const;

// Audio storage paths (relative to documentDirectory)
export const AUDIO_STORAGE = {
  BASE_DIR: "athkar-audio",
  MANIFESTS_DIR: "athkar-audio/manifests",
  AUDIO_DIR: "athkar-audio/audio",
  CATALOG_FILE: "athkar-audio/manifests/reciters.json",
} as const;

// UI sizing
export const AUDIO_UI = {
  CONTROL_SIZE: 44,
  CONTROL_SIZE_COMFORT: 56,
  CONTROL_GAP: 8,
  MINI_PLAYER_HEIGHT: 64,
  MINI_PLAYER_HEIGHT_COMFORT: 80,
  AUDIO_ZONE_PERCENT: 0.3,
  TAP_ZONE_PERCENT: 0.7,
} as const;

// Audio ID entry: string for shared athkar, object for morning/evening variants
export type AudioIdEntry = string | { morning: string; evening: string };

// Maps athkar order number to manifest thikrId(s)
// Matches the order field from DEFAULT_ATHKAR_DATA (orders 1-24)
// String = same audio for morning & evening (shared)
// Object = different audio for morning vs evening
export const ATHKAR_AUDIO_MAP: Record<number, AudioIdEntry> = {
  1: "ayat-al-kursi",
  2: "al-ikhlas",
  5: { morning: "morning-praise", evening: "evening-praise" },
  6: { morning: "morning-grace", evening: "evening-grace" },
  7: "sayyid-al-istighfar",
  8: { morning: "morning-witness", evening: "evening-witness" },
  9: { morning: "morning-gratitude", evening: "evening-gratitude" },
  10: "seeking-wellbeing",
  11: "hasbi-allah",
  12: "seeking-afiyah",
  13: "knower-of-unseen",
  14: "bismillah-protection",
  15: "raditu-billah",
  16: "ya-hayyu-ya-qayyum",
  17: { morning: "morning-lord-of-worlds", evening: "evening-lord-of-worlds" },
  18: { morning: "morning-fitrah", evening: "evening-fitrah" },
  19: "tasbih",
  20: "tahlil",
  21: "tasbih-extended",
  22: { morning: "beneficial-knowledge", evening: "istighfar" },
  23: { morning: "istighfar", evening: "perfect-words" },
  24: "salawat",
};

// Resolves the thikrId for a given order and session type
export const getThikrId = (order: number, sessionType: "morning" | "evening"): string | null => {
  const entry = ATHKAR_AUDIO_MAP[order];
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  return entry[sessionType] ?? null;
};
