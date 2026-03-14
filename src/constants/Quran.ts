import { MushafVersion, QuranTheme } from "@/enums/quran";

export const TOTAL_PAGES = 604;
export const LINES_PER_PAGE = 15;
export const IMAGE_SOURCE_WIDTH = 1440;

export const QURAN_THEME_COLORS: Record<
  QuranTheme,
  {
    background: string;
    textTint: string | undefined;
    markerColor: string;
    headerColor: string;
    pageNumberColor: string;
  }
> = {
  [QuranTheme.LIGHT]: {
    background: "#FFFDF7",
    textTint: undefined,
    markerColor: "#B8860B",
    headerColor: "#2C1810",
    pageNumberColor: "#8B7355",
  },
  [QuranTheme.DARK]: {
    background: "#1A1A2E",
    textTint: "#E8E0D4",
    markerColor: "#C4A265",
    headerColor: "#E8E0D4",
    pageNumberColor: "#A89880",
  },
  [QuranTheme.SEPIA]: {
    background: "#F4E8D1",
    textTint: "#3E2723",
    markerColor: "#8B6914",
    headerColor: "#3E2723",
    pageNumberColor: "#6D4C41",
  },
} as const;

export const DEFAULT_MUSHAF_VERSION = MushafVersion.V1;
export const DEFAULT_QURAN_THEME = QuranTheme.LIGHT;
