import {
  MushafVersion,
  QuranTheme,
  LineType,
  DownloadStatus,
  SurahFrameStyle,
  ReaderViewMode,
} from "@/enums/quran";

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

export type LineMetadata = {
  page: number;
  line: number;
  type: LineType;
  surahNumber: number | null;
  surahName: string | null;
};

export type DownloadPhase = "downloading" | "extracting" | "finalizing";

export type DownloadProgress = {
  phase: DownloadPhase;
  bytesDownloaded: number;
  totalBytes: number;
  percent: number;
};

export type VersionDownloadState = {
  status: DownloadStatus;
  progress: DownloadProgress | null;
};

export type QuranBundle = {
  path: string;
  sizeMB: number;
  checksum: string;
};

export type QuranManifestVersion = {
  id: string;
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
  markers: string[];
  manifestChecksum: string;
};

export type QuranManifest = {
  manifestVersion: number;
  versions: QuranManifestVersion[];
};

export type QuranState = {
  currentPage: number;
  currentVersion: MushafVersion;
  quranTheme: QuranTheme;
  // When true, `quranTheme` is the user's explicit choice. When false, the
  // resolved theme follows the app's color scheme (light → SEPIA, dark → DARK).
  // Set by `setQuranTheme`; cleared by `setQuranThemeAuto`. Read effective
  // theme via the `useResolvedQuranTheme` hook, not `quranTheme` directly.
  quranThemeOverride: boolean;
  surahFrameStyle: SurahFrameStyle;
  lastReadPage: number;
  readerMode: ReaderViewMode;
  fontSize: number;

  onboardingComplete: boolean;
  selectedVersion: MushafVersion | null;
  versionDownloads: Partial<Record<MushafVersion, VersionDownloadState>>;

  setCurrentPage: (page: number) => void;
  setCurrentVersion: (version: MushafVersion) => void;
  setQuranTheme: (theme: QuranTheme) => void;
  setQuranThemeAuto: () => void;
  setSurahFrameStyle: (style: SurahFrameStyle) => void;
  setReaderMode: (mode: ReaderViewMode) => void;
  setFontSize: (size: number) => void;

  setOnboardingComplete: () => void;
  setSelectedVersion: (version: MushafVersion) => void;
  updateDownloadState: (version: MushafVersion, state: Partial<VersionDownloadState>) => void;
  removeVersion: (version: MushafVersion) => void;
  isVersionComplete: (version: MushafVersion) => boolean;
};
