export enum MushafVersion {
  V1 = "v1",
  V2 = "v2",
  V4 = "v4",
}

export enum ReaderViewMode {
  MADINAH = "madinah",
  TEXT = "text",
}

export const QuranTheme = {
  NEDAA_LIGHT: "nedaa-light",
  NEDAA_DARK: "nedaa-dark",
  SEPIA: "sepia",
  DARK: "dark",
  LIGHT: "light",
} as const;
export type QuranThemeType = (typeof QuranTheme)[keyof typeof QuranTheme];

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

// Ayah action-sheet sub-views (swapped into the sheet body): similar verses, the
// per-ayah tajweed rule list, and the sajda guidance.
export const AyahSubViewKind = {
  MUTASHABIHAT: "mutashabihat",
  TAJWEED: "tajweed",
  SAJDA: "sajda",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type AyahSubViewKind = (typeof AyahSubViewKind)[keyof typeof AyahSubViewKind];

// How the audio read-along highlights the recited text: the whole verse, or the
// current word (falls back to verse when word timings are missing/divergent).
export const ReadAlongGranularity = {
  AYAH: "ayah",
  WORD: "word",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type ReadAlongGranularity = (typeof ReadAlongGranularity)[keyof typeof ReadAlongGranularity];

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

// An edition download is one visible job in two steps: page images (+ their
// geometry meta) land first, then the ornament decoration packs. Surfaced in
// the UI as "Step 1/2" / "Step 2/2" so the two phases read as a plan, not a
// stall after 100%.
export const DownloadStep = {
  IMAGES: "images",
  ORNAMENTS: "ornaments",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type DownloadStep = (typeof DownloadStep)[keyof typeof DownloadStep];

// Result of a single bundle download attempt (download → extract).
export const BundleOutcome = {
  EXTRACTED: "extracted",
  CANCELLED: "cancelled",
  PAUSED: "paused",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type BundleOutcome = (typeof BundleOutcome)[keyof typeof BundleOutcome];

// Shareable ayah card: the verse as its actual-edition Mushaf image, or as
// styled Hafs text on themed paper.
export const ShareCardStyle = {
  IMAGE: "image",
  TEXT: "text",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type ShareCardStyle = (typeof ShareCardStyle)[keyof typeof ShareCardStyle];

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

// Two-page spread on large devices: AUTO lets pane width decide; ON/OFF are
// explicit user choices that geometry never overrides.
export const SpreadPreference = {
  AUTO: "auto",
  ON: "on",
  OFF: "off",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type SpreadPreference = (typeof SpreadPreference)[keyof typeof SpreadPreference];

// Reader paging axis. HORIZONTAL: swipe page-to-page (spread allowed). VERTICAL:
// one continuous column of pages that scrolls, where auto-scroll is available.
export const ScrollDirection = {
  HORIZONTAL: "horizontal",
  VERTICAL: "vertical",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type ScrollDirection = (typeof ScrollDirection)[keyof typeof ScrollDirection];

// Auto-scroll (vertical continuous mode) reading pace — three presets, not a
// slider (large, unambiguous tap targets).
export const AutoScrollSpeed = {
  SLOW: "slow",
  MEDIUM: "medium",
  FAST: "fast",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type AutoScrollSpeed = (typeof AutoScrollSpeed)[keyof typeof AutoScrollSpeed];

// Ornament categories: each page ornament resolves its style (bundled nedaa
// default, or a downloaded pack) independently per category.
export const OrnamentCategory = {
  AYAH_MARKER: "ayahMarker",
  SURAH_FRAME: "surahFrame",
  PAGE_HOLDER: "pageHolder",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type OrnamentCategory = (typeof OrnamentCategory)[keyof typeof OrnamentCategory];

// Pre-tinted theme slots shipped inside every ornament pack; the app maps its
// five reader themes onto the sepia (dark-ink) and dark (light-ink) slots.
export const OrnamentSlot = {
  LIGHT: "light",
  SEPIA: "sepia",
  DARK: "dark",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type OrnamentSlot = (typeof OrnamentSlot)[keyof typeof OrnamentSlot];

// Logical asset stems inside a pack: file names are `<asset>-<slot>.png` and
// pack.json metadata is keyed by the same stem.
export const OrnamentAsset = {
  FRAME: "frame", // surahFrame
  MARKER: "marker", // ayahMarker
  CARTOUCHE: "cartouche", // pageHolder, normal pages
  QUARTER_LEFT: "quarter-left", // pageHolder hizb-quarter, narrow cell left
  QUARTER_RIGHT: "quarter-right", // pageHolder hizb-quarter, narrow cell right
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type OrnamentAsset = (typeof OrnamentAsset)[keyof typeof OrnamentAsset];
