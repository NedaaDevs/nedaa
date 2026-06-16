import {
  MushafVersion,
  QuranThemeType,
  LineType,
  DownloadStatus,
  DownloadPhase,
  ReaderViewMode,
  ReaderPageFit,
  RevelationPlace,
  SajdaType,
  ShareCardStyle,
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

export type QuranBundle = {
  path: string;
  sizeMB: number;
  checksum: string;
};

// A single preview page (a concatenated full-page image) for the version picker.
export type QuranPreview = {
  page: number;
  path: string;
  width: number;
  height: number;
};

export type QuranManifestVersion = {
  id: string;
  published: boolean;
  name: string;
  yearHijri: number;
  yearGregorian: number;
  totalPages: number;
  linesPerPage: number;
  imageWidth: number;
  imageHeight: number;
  totalSizeMB: number;
  baseUrl: string;
  bundle: QuranBundle;
  darkBundle?: QuranBundle;
  previews: QuranPreview[];
  darkPreviews?: QuranPreview[];
  markers: string[];
  manifestChecksum: string;
};

export type QuranManifest = {
  manifestVersion: number;
  versions: QuranManifestVersion[];
};

export type QuranLibraryTab = "index" | "highlights" | "bookmarks" | "khatmah" | "guide";

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
  // Two-page spread on large screens in landscape. On by default.
  twoPageSpread: boolean;
  // Large-device page-fit: plain fill or a framed "page" look. Fill by default.
  pageFit: ReaderPageFit;
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

  setCurrentPage: (page: number) => void;
  setCurrentVersion: (version: MushafVersion) => void;
  setQuranTheme: (theme: QuranThemeType) => void;
  setQuranThemeAuto: () => void;
  setReaderMode: (mode: ReaderViewMode) => void;
  setFontSize: (size: number) => void;
  setTwoPageSpread: (on: boolean) => void;
  setPageFit: (fit: ReaderPageFit) => void;
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
  updateDownloadState: (version: MushafVersion, state: Partial<VersionDownloadState>) => void;
  updateDarkDownloadState: (version: MushafVersion, state: Partial<BundleDownloadState>) => void;
  removeVersion: (version: MushafVersion) => void;
  removeDark: (version: MushafVersion) => void;
  dismissDarkOffer: (version: MushafVersion) => void;
  isVersionComplete: (version: MushafVersion) => boolean;
  isDarkComplete: (version: MushafVersion) => boolean;
};
