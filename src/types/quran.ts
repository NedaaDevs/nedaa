import {
  MushafVersion,
  MushafImageType,
  QuranTheme,
  LineType,
  DownloadStatus,
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

export type LineMetadata = {
  page: number;
  line: number;
  type: LineType;
  surahNumber: number | null;
  surahName: string | null;
};

export type DownloadProgress = {
  currentPage: number;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  bytesDownloaded: number;
  totalBytes: number;
  currentSurahName: string;
};

export type VersionDownloadState = {
  status: DownloadStatus;
  progress: DownloadProgress | null;
};

export type QuranVersionPaths = {
  lines?: string;
  pages?: string;
  boundsDb: string;
  markers: string;
};

export type QuranVersionChecksums = {
  boundsDb: string;
  manifest: string;
};

export type QuranManifestVersion = {
  id: string;
  name: string;
  yearHijri: number;
  yearGregorian: number;
  totalPages: number;
  type: MushafImageType;
  linesPerPage: number;
  imageWidth: number;
  imageHeight: number;
  totalSizeMB: number;
  boundsDbSizeMB: number;
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
  lastReadPage: number;

  onboardingComplete: boolean;
  selectedVersion: MushafVersion | null;
  versionDownloads: Partial<Record<MushafVersion, VersionDownloadState>>;

  setCurrentPage: (page: number) => void;
  setCurrentVersion: (version: MushafVersion) => void;
  setQuranTheme: (theme: QuranTheme) => void;

  setOnboardingComplete: () => void;
  setSelectedVersion: (version: MushafVersion) => void;
  updateDownloadState: (version: MushafVersion, state: Partial<VersionDownloadState>) => void;
  isVersionComplete: (version: MushafVersion) => boolean;
};
