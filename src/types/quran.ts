import type { QuranAudioManifest } from "@/types/quran-audio";
import {
  MushafVersion,
  MushafImageType,
  QuranThemeType,
  LineType,
  DownloadStatus,
  DownloadPhase,
  ReaderViewMode,
  RevelationPlace,
  SajdaType,
  ShareCardStyle,
  ScrollDirection,
  SpreadPreference,
} from "@/enums/quran";

export type { DownloadPhase };

export type GlyphBound = {
  page: number;
  line: number;
  position: number;
  surahNumber: number;
  ayahNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isMarker: boolean;
};

export type AyahTextData = {
  surahNumber: number;
  ayahNumber: number;
  text: string;
};

// Surah reference data (from the `surahs` metadata table).
export type SurahMeta = {
  number: number;
  nameArabic: string;
  nameTransliterated: string;
  revelationPlace: RevelationPlace;
  revelationOrder: number;
  ayahCount: number;
  bismillahPre: boolean;
  pageStart: number;
  pageEnd: number;
};

// Full per-ayah metadata for the press-to-highlight info sheet
// (divisions resolved via the `ayah_divisions` view + surah/page facts).
export type AyahMetadata = {
  surahNumber: number;
  ayahNumber: number;
  juz: number;
  hizb: number;
  rub: number;
  manzil: number;
  ruku: number;
  sajdaType: SajdaType | null;
  page: number;
  surahNameArabic: string;
  surahNameTransliterated: string;
};

export type LineMetadata = {
  page: number;
  line: number;
  type: LineType;
  surahNumber: number | null;
  surahName: string | null;
};

export type DownloadProgress = {
  phase: DownloadPhase;
  bytesDownloaded: number;
  totalBytes: number;
  percent: number;
};

export type BundleDownloadState = {
  status: DownloadStatus;
  progress: DownloadProgress | null;
};

// `dark` tracks the optional dark-theme bundle (V4) independently of the main
// (light) bundle, so it can be downloaded later or deleted on its own.
export type VersionDownloadState = BundleDownloadState & {
  dark?: BundleDownloadState;
};

// A downloadable, checksummed artifact, addressed relative to manifest.baseUrl.
export type QuranAsset = {
  url: string;
  bytes: number;
  sha256: string;
};

// A single preview page (a concatenated full-page image) for the version picker.
export type QuranPreview = {
  page: number;
  url: string;
  width: number;
  height: number;
};

export type QuranEditionImages = {
  version: string;
  pages: number;
  light: QuranAsset;
  dark?: QuranAsset;
};

// The per-edition meta/bounds bundle (glyph geometry, line metadata). Versioned
// independently of the images; `requiresImages` is the images version it was
// built against — geometry only aligns with that exact render.
export type QuranEditionMeta = QuranAsset & {
  version: string;
  schema: number;
  requiresImages: string;
};

// One mushaf edition. (Named QuranManifestVersion for continuity with callers.)
export type QuranManifestVersion = {
  id: string;
  published: boolean;
  name: string;
  imageType: MushafImageType;
  resolution: number;
  yearHijri: number;
  yearGregorian: number;
  linesPerPage: number;
  images: QuranEditionImages;
  meta: QuranEditionMeta;
  previews: QuranPreview[];
  darkPreviews?: QuranPreview[];
};

// The shared content DB (ayah text, surah/division metadata, mutashabihat),
// downloaded once from the CDN rather than bundled.
export type QuranContent = {
  version: string;
  schema: number;
  url: string;
  bytes: number;
  sha256: string;
};

// A selectable ornament style (e.g. ayah-marker frames) as a downloadable pack.
export type QuranOrnamentOption = QuranAsset & {
  id: string;
  version: string;
  resolution?: number;
  // Editions this option applies to (the marker artwork differs per edition).
  editions?: string[];
  preview?: string;
};

export type QuranOrnamentGroup = {
  default: string;
  // Per-edition default option id, overriding `default`.
  defaultByEdition?: Record<string, string>;
  options: QuranOrnamentOption[];
};

// Selectable style packs overlaid on the reader, keyed off bounds positions.
export type QuranOrnaments = {
  ayahMarker?: QuranOrnamentGroup;
  surahFrame?: QuranOrnamentGroup;
  pageHolder?: QuranOrnamentGroup;
};

export type QuranManifest = {
  manifestSchema: number;
  baseUrl: string;
  editions: QuranManifestVersion[];
  content: QuranContent;
  // Style packs (ayah-marker frames etc.) downloaded per edition; the ayah-marker
  // default pack carries the medallion frames the reader overlays on each ayah.
  ornaments?: QuranOrnaments;
  // Recitation audio catalog; absent until at least one reciter is published.
  audio?: QuranAudioManifest;
};

export type QuranLibraryTab =
  "index" | "highlights" | "bookmarks" | "khatmah" | "reminders" | "guide";

export type QuranState = {
  currentPage: number;
  currentVersion: MushafVersion;
  quranTheme: QuranThemeType;
  // When true, `quranTheme` is the user's explicit choice. When false, the
  // resolved theme follows the app's color scheme onto Nedaa paper
  // (light → NEDAA_LIGHT, dark → NEDAA_DARK). Set by `setQuranTheme`; cleared by
  // `setQuranThemeAuto`. Read effective theme via the `useResolvedQuranTheme`
  // hook, not `quranTheme` directly.
  quranThemeOverride: boolean;
  lastReadPage: number;
  readerMode: ReaderViewMode;
  fontSize: number;
  // Two-page spread on large landscape: AUTO lets geometry decide; ON/OFF are explicit.
  spreadPreference: SpreadPreference;
  // Reader paging axis: HORIZONTAL page-turn, or VERTICAL continuous scroll.
  scrollDirection: ScrollDirection;
  // Auto-scroll glide (vertical continuous mode). `playing` is transient — motion
  // only starts on a deliberate tap; `speed` is a persisted points/second pace.
  autoScrollPlaying: boolean;
  autoScrollSpeed: number;
  // The Library hub's last-viewed tab, so reopening lands where the user left.
  libraryTab: QuranLibraryTab;
  // Ayah image-share preferences (persisted): which card style was last used,
  // and whether to stamp the Nedaa logo on the shared image.
  shareStyle: ShareCardStyle;
  shareIncludeLogo: boolean;

  onboardingComplete: boolean;
  selectedVersion: MushafVersion | null;
  versionDownloads: Partial<Record<MushafVersion, VersionDownloadState>>;
  // Per-version: the user dismissed the "download dark pages" offer, so it is
  // not shown again for that edition (they can still add it from settings).
  darkOfferDismissed: Partial<Record<MushafVersion, boolean>>;
  // Transient — true only while the immersive reader (not chrome) is visible.
  readerActive: boolean;
  // Transient — an ayah to briefly pulse-highlight after a search jump, so the
  // reader can spot it on the page. Cleared automatically once the pulse ends.
  flashAyah: { surah: number; ayah: number } | null;
  // Transient — the page to return to after a mutashabihat "go to" jump.
  jumpReturn: number | null;
  // Persisted — show the at-a-glance similar-verse markers in the reader ("huffaz mode").
  showMutashabihatMarkers: boolean;
  // Persisted — personal memory note per mutashabihat group, keyed by group id.
  mutashabihatNotes: Record<string, string>;
  // Persisted — whether the first-open reader walkthrough has been seen.
  hasSeenQuranGuide: boolean;

  setCurrentPage: (page: number) => void;
  setCurrentVersion: (version: MushafVersion) => void;
  setQuranTheme: (theme: QuranThemeType) => void;
  setQuranThemeAuto: () => void;
  setReaderMode: (mode: ReaderViewMode) => void;
  setFontSize: (size: number) => void;
  setSpreadPreference: (pref: SpreadPreference) => void;
  setScrollDirection: (dir: ScrollDirection) => void;
  setAutoScrollPlaying: (playing: boolean) => void;
  toggleAutoScroll: () => void;
  setAutoScrollSpeed: (px: number) => void;
  setLibraryTab: (tab: QuranLibraryTab) => void;
  setShareStyle: (style: ShareCardStyle) => void;
  setShareIncludeLogo: (on: boolean) => void;

  setOnboardingComplete: () => void;
  setSelectedVersion: (version: MushafVersion) => void;
  setReaderActive: (active: boolean) => void;
  setFlashAyah: (target: { surah: number; ayah: number }) => void;
  clearFlashAyah: () => void;
  setJumpReturn: (page: number | null) => void;
  setShowMutashabihatMarkers: (on: boolean) => void;
  setMutashabihatNote: (groupId: string, text: string) => void;
  setQuranGuideSeen: () => void;
  updateDownloadState: (version: MushafVersion, state: Partial<VersionDownloadState>) => void;
  updateDarkDownloadState: (version: MushafVersion, state: Partial<BundleDownloadState>) => void;
  removeVersion: (version: MushafVersion) => void;
  removeDark: (version: MushafVersion) => void;
  dismissDarkOffer: (version: MushafVersion) => void;
  isVersionComplete: (version: MushafVersion) => boolean;
  isDarkComplete: (version: MushafVersion) => boolean;
};
