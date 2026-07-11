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

export const QURAN_GRANULARITY = {
  AYAH: "ayah", // one file per ayah
  SURAH: "surah", // one gapless file per surah
} as const;
export type QuranGranularity = (typeof QURAN_GRANULARITY)[keyof typeof QURAN_GRANULARITY];

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
  // Exact size in bytes of each surah's audio file, indexed 0 = surah 1 (114
  // entries). Surah-granular only; when absent the size is estimated by page span.
  surahBytes?: number[];
  published: boolean;
  // Per-word timing artifact (QUL segments) for read-along word highlighting.
  // Ayah-granular only; absent → read-along degrades to ayah-level highlight.
  timings?: { url: string; version: string; bytes: number };
};

// One recited word: [wordIndex (1-based, reading order), startMs, endMs] with
// times relative to that ayah's audio file. Maps to the ayah's Nth word-glyph.
export type WordSegment = [number, number, number];
// Per-ayah word segments, keyed "surah:ayah".
export type AyahSegmentMap = Record<string, WordSegment[]>;

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
export const isReaderEligible = (r: QuranRecitation): boolean =>
  r.granularity === QURAN_GRANULARITY.AYAH;

export const QURAN_QUEUE_KIND = {
  AYAH: "ayah", // a single ayah
  FROM_HERE: "from-here", // this ayah to the end of the surah
  SURAH: "surah", // a whole surah (gapless)
} as const;
export type QuranQueueKind = (typeof QURAN_QUEUE_KIND)[keyof typeof QURAN_QUEUE_KIND];

// Reader (per-ayah) sessions are every queue kind except the Listen surah queue.
export const isReaderQueue = (kind: QuranQueueKind | null | undefined): boolean =>
  kind != null && kind !== QURAN_QUEUE_KIND.SURAH;

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
