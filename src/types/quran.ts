import { MushafVersion, QuranTheme, LineType } from "@/enums/quran";

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

export type QuranState = {
  currentPage: number;
  currentVersion: MushafVersion;
  quranTheme: QuranTheme;
  lastReadPage: number;

  setCurrentPage: (page: number) => void;
  setCurrentVersion: (version: MushafVersion) => void;
  setQuranTheme: (theme: QuranTheme) => void;
};
