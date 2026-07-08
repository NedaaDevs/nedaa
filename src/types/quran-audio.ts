export const QURAN_PLAYER_STATE = {
  IDLE: "idle",
  LOADING: "loading",
  PLAYING: "playing",
  PAUSED: "paused",
} as const;
export type QuranPlayerState = (typeof QURAN_PLAYER_STATE)[keyof typeof QURAN_PLAYER_STATE];

// What happens when a surah finishes playing.
export const QURAN_LISTEN_MODE = {
  STOP: "stop", // stop at end of surah
  ADVANCE: "advance", // continue to the next surah
  REPEAT_SURAH: "repeat", // loop the current surah
} as const;
export type QuranListenMode = (typeof QURAN_LISTEN_MODE)[keyof typeof QURAN_LISTEN_MODE];

export type QuranGranularity = "ayah" | "surah";

// A reciter's complete audio set in one style — the unit the player plays.
export type QuranRecitation = {
  id: string; // recitation slug, e.g. "minshawi-murattal"
  style: string; // "Murattal" | "Mujawwad" | "Tajweed" | ...
  riwayah: string; // "hafs" | ...
  granularity: QuranGranularity; // "ayah" = one file per ayah; "surah" = one gapless file per surah
  basePath: string; // relative to manifest.baseUrl, e.g. "audio/minshawi-murattal/"
  fileFormat: string; // "mp3"
  ayahCount: number;
  bytesApprox: number;
  published: boolean;
  timings?: { url: string; version: string; bytes: number }; // surah-granular only
};

// A reciter (person) groups one or more recitations — the display/grouping unit.
export type QuranReciter = {
  id: string; // person slug, e.g. "minshawi"
  nameArabic: string;
  nameEnglish: string;
  recitations: QuranRecitation[];
};

export type QuranAudioManifest = {
  version: string;
  defaultRecitationId: string;
  reciters: QuranReciter[];
};

// A gapless (surah) file can't drive per-ayah highlighting, so only ayah-granular
// recitations can play in the reader.
export const isReaderEligible = (r: QuranRecitation): boolean => r.granularity === "ayah";

export type QuranQueueKind = "ayah" | "from-here" | "surah";

// One ayah's playable entry in a session queue.
export type QuranQueueItem = {
  surah: number;
  ayah: number;
  url: string; // local path if downloaded, else remote CDN url
};

// Describes what's currently loaded: which surah and which ayah range.
export type QuranQueueDescriptor = {
  kind: QuranQueueKind;
  surah: number;
  fromAyah: number;
  toAyah: number;
};
