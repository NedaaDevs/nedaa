export enum MushafVersion {
  V1 = "v1",
  V2 = "v2",
  V4 = "v4",
}

export enum ReaderViewMode {
  MADINAH = "madinah",
  TEXT = "text",
}

export enum QuranTheme {
  SEPIA = "sepia",
  DARK = "dark",
  LIGHT = "light",
  AMOLED = "amoled",
}

export enum MushafImageType {
  LINE = "line",
  PAGE = "page",
}

export enum LineType {
  TEXT = "text",
  SURAH_HEADER = "surah-header",
  BASMALA = "basmala",
  EMPTY = "empty",
}

export enum SurahFrameStyle {
  CARTOUCHE = "cartouche",
  CLASSIC = "classic",
  GEOMETRIC = "geometric",
}

export enum DownloadStatus {
  IDLE = "idle",
  DOWNLOADING = "downloading",
  PAUSED = "paused",
  COMPLETE = "complete",
  ERROR = "error",
}

export enum PageDownloadStatus {
  PENDING = "pending",
  DOWNLOADING = "downloading",
  COMPLETE = "complete",
  FAILED = "failed",
}

export enum DownloadPhase {
  DOWNLOADING = "downloading",
  EXTRACTING = "extracting",
  FINALIZING = "finalizing",
}

// Result of a single bundle download attempt (download → extract).
export const BundleOutcome = {
  EXTRACTED: "extracted",
  CANCELLED: "cancelled",
  PAUSED: "paused",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type BundleOutcome = (typeof BundleOutcome)[keyof typeof BundleOutcome];

// Highlight tag colours — each can be relabelled by the user (e.g. "Memorization").
export const HighlightColor = {
  RED: "red",
  ORANGE: "orange",
  AMBER: "amber",
  GREEN: "green",
  TEAL: "teal",
  BLUE: "blue",
  PURPLE: "purple",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type HighlightColor = (typeof HighlightColor)[keyof typeof HighlightColor];

// Bookmark ribbon colours — a separate 4-colour jewel palette, deliberately off
// the highlight hues. Each colour is one mushaf-wide ribbon "slot"; the palette
// itself is the cap (4 places). Tapping an in-use colour moves its ribbon.
export const BookmarkColor = {
  GARNET: "garnet",
  BRASS: "brass",
  PINE: "pine",
  INDIGO: "indigo",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type BookmarkColor = (typeof BookmarkColor)[keyof typeof BookmarkColor];

export enum SajdaType {
  REQUIRED = "required",
  OPTIONAL = "optional",
}

export enum RevelationPlace {
  MAKKAH = "makkah",
  MADINAH = "madinah",
}
