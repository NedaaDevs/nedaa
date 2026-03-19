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

export type QuranVersionPaths = {
  bundle: string;
  lines?: string;
  pages?: string;
  boundsDb?: string;
  markers?: string;
};

export type QuranVersionChecksums = {
  bundle: string;
  manifest: string;
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
  bundleSizeMB: number;
  baseUrl: string;
  paths: QuranVersionPaths;
  markers: string[];
  checksums: QuranVersionChecksums;
};

export type QuranManifest = {
  manifestVersion: number;
  versions: QuranManifestVersion[];
};

export type QuranState = {
  currentPage: number;
  currentVersion: MushafVersion;
  quranTheme: QuranTheme;
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
  setSurahFrameStyle: (style: SurahFrameStyle) => void;
  setReaderMode: (mode: ReaderViewMode) => void;
  setFontSize: (size: number) => void;

  setOnboardingComplete: () => void;
  setSelectedVersion: (version: MushafVersion) => void;
  updateDownloadState: (version: MushafVersion, state: Partial<VersionDownloadState>) => void;
  isVersionComplete: (version: MushafVersion) => boolean;
};
